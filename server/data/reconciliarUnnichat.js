import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../../config.js';
import { bancoPadrao } from './db.js';
import { comoMapa } from './crmPipelines.js';

// Reconciliação por pull direto na UnniAPI, pra pegar o que o webhook do n8n
// perdeu (o caso "Sem CRM" que achamos em Manaus/Blumenau). A API não lista
// pipeline/coluna (confirmado com o suporte em 28/08/2026) — por isso o mapa
// vem da tabela crm_pipelines (cadastrada pela tela de admin), a única fonte
// de quais IDs existem; pipeline novo precisa ser cadastrado lá antes de
// entrar aqui.
const API_BASE = 'https://unnichat.com.br/api';
const TENTATIVAS = 4;
const PER_PAGE = 100;

async function chamarComRetry(url, token, fetchImpl) {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const resp = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.ok) return resp.json();
    if (tentativa === TENTATIVAS) throw new Error(`${url} respondeu ${resp.status} após ${tentativa} tentativas`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (tentativa - 1)));
  }
}

async function paginar(caminho, token, fetchImpl) {
  const itens = [];
  let page = 1;
  for (;;) {
    const corpo = await chamarComRetry(`${API_BASE}${caminho}${caminho.includes('?') ? '&' : '?'}perPage=${PER_PAGE}&page=${page}`, token, fetchImpl);
    itens.push(...(corpo.data ?? []));
    if (!corpo.metadata?.hasNext) return itens;
    page += 1;
  }
}

// Nenhuma rota tem teto documentado ainda (valem a partir de 01/09/2026, e
// mesmo aí `deals/column`/`deals/won` ficaram de fora da tabela que o suporte
// mandou) — mas um respiro pequeno entre chamadas não custa nada e evita
// martelar a API à toa.
const PAUSA_ENTRE_CHAMADAS_MS = 150;
const pausa = () => new Promise((r) => setTimeout(r, PAUSA_ENTRE_CHAMADAS_MS));

// Cada negócio de deals/won e deals/lost ainda traz o `columnId` de onde
// saiu — por isso dá pra tratar as três rotas (aberto, ganho, perdido) do
// mesmo jeito, só variando o caminho.
async function buscarTodosOsNegocios(token, fetchImpl, mapa) {
  const negocios = [];
  for (const [pipelineName, info] of Object.entries(mapa)) {
    const colunaPorId = Object.fromEntries(Object.entries(info.colunas).map(([nome, id]) => [id, nome]));
    const caminhos = [
      ...Object.values(info.colunas).map((columnId) => `/crm/pipelines/${info.pipelineId}/deals/column/${columnId}`),
      `/crm/pipelines/${info.pipelineId}/deals/won`,
      `/crm/pipelines/${info.pipelineId}/deals/lost`,
    ];
    for (const caminho of caminhos) {
      const itens = await paginar(caminho, token, fetchImpl);
      for (const item of itens) {
        if (!item.phoneNumber) continue; // sem telefone não dá pra casar com info_leads
        negocios.push({
          telefone: item.phoneNumber,
          nome: item.contactName ?? '',
          email: item.email ?? '',
          idContato: item.contactId ?? '',
          pipelineId: info.pipelineId,
          pipelineName,
          etapaId: item.columnId ?? '',
          etapaName: colunaPorId[item.columnId] ?? '',
        });
      }
      await pausa();
    }
  }
  return negocios;
}

async function buscarExistentes(bq, pipelineIds) {
  const lista = pipelineIds.map((id) => `'${id}'`).join(',');
  const [linhas] = await bq.query({
    query: `SELECT Telefone, PipelineId, TRIM(EtapaId) AS EtapaId
            FROM \`leads-ts.hub_uni.info_leads\`
            WHERE PipelineId IN (${lista})`,
  });
  const mapa = new Map();
  for (const l of linhas) mapa.set(`${l.Telefone}|${l.PipelineId}`, l.EtapaId);
  return mapa;
}

function diferenca(negocios, existentes) {
  const faltando = [];
  const desatualizados = [];
  for (const n of negocios) {
    const chave = `${n.telefone}|${n.pipelineId}`;
    if (!existentes.has(chave)) { faltando.push(n); continue; }
    if (existentes.get(chave) !== n.etapaId) desatualizados.push(n);
  }
  return { faltando, desatualizados };
}

function escapar(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Mesmo padrão de MERGE que a automação do n8n já usa pra escrever em
// info_leads — só que aqui a fonte são os negócios pegos direto na API, não
// enriquecidos (Palestrante/Atendente/DataCheckin ficam de fora; o fallback
// de quem subiu ao palco em server/domain/metricas.js cobre a ausência de
// Palestrante).
const TAMANHO_LOTE = 300;

async function aplicarNoBigQuery(bq, itens) {
  for (let inicio = 0; inicio < itens.length; inicio += TAMANHO_LOTE) {
    const lote = itens.slice(inicio, inicio + TAMANHO_LOTE);
    const linhas = lote.map((n) => `SELECT '${escapar(n.nome)}' AS Nome, '${escapar(n.email)}' AS Email,
      '${escapar(n.telefone)}' AS Telefone, '${escapar(n.idContato)}' AS IdContato,
      '${escapar(n.pipelineId)}' AS PipelineId, '${escapar(n.pipelineName)}' AS PipelineName,
      '${escapar(n.etapaId)}' AS EtapaId, '${escapar(n.etapaName)}' AS EtapaName`).join('\nUNION ALL\n');
    const sql = `MERGE INTO \`leads-ts.hub_uni.info_leads\` AS T
      USING (${linhas}) AS S
      ON T.Telefone = S.Telefone AND T.PipelineId = S.PipelineId
      WHEN MATCHED AND T.EtapaId IS DISTINCT FROM S.EtapaId THEN
        UPDATE SET EtapaId = S.EtapaId, EtapaName = S.EtapaName
      WHEN NOT MATCHED THEN
        INSERT (Nome, Email, Telefone, IdContato, PipelineId, PipelineName, EtapaId, EtapaName)
        VALUES (S.Nome, S.Email, S.Telefone, S.IdContato, S.PipelineId, S.PipelineName, S.EtapaId, S.EtapaName)`;
    await bq.query({ query: sql });
  }
}

export async function reconciliar(deps = {}) {
  const token = deps.token ?? config.unnichatToken;
  if (!token) throw new Error('UNNICHAT_TOKEN não configurado');
  const fetchImpl = deps.fetch ?? fetch;
  const bq = deps.bq ?? new BigQuery({ projectId: config.projectId });
  const escrever = deps.escrever ?? true;
  const mapa = deps.mapa ?? await comoMapa(deps.db ?? await bancoPadrao());
  if (!Object.keys(mapa).length) throw new Error('crm_pipelines está vazia — cadastre ao menos um pipeline antes de reconciliar');

  const negocios = await buscarTodosOsNegocios(token, fetchImpl, mapa);
  const pipelineIds = [...new Set(Object.values(mapa).map((p) => p.pipelineId))];
  const existentes = await buscarExistentes(bq, pipelineIds);
  const { faltando, desatualizados } = diferenca(negocios, existentes);

  if (escrever && (faltando.length || desatualizados.length)) {
    await aplicarNoBigQuery(bq, [...faltando, ...desatualizados]);
  }

  return { negociosVistos: negocios.length, faltando: faltando.length, desatualizados: desatualizados.length };
}
