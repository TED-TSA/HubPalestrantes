import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../../config.js';

// leads-ts.Presenciais.Guests alimenta o check-in que server/data/sincronizacao.js
// cruza por telefone. O retorno da esteira que preenche essa tabela é grande
// demais para caber numa execução de n8n — por isso este job roda fora do
// sync de 15 minutos (leads/palestras), como uma carga diária separada.
const GUESTS_API_URL = 'https://us-central1-attendoo-1c997.cloudfunctions.net/guestsBI';
// Página vazia nunca deveria repetir sem cursor novo; se acontecer é bug da
// origem (visto no código original desta chamada) — para em vez de girar.
const MAX_PAGINAS = 2000;

// A origem devolve 500 esporadicamente (visto na prática: 29 páginas OK, a
// 30ª falhou) — provavelmente cold start da cloud function. Vale tentar de
// novo antes de abortar o job inteiro por isso.
const TENTATIVAS_POR_PAGINA = 4;

async function buscarPagina(url, token, fetchImpl) {
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_PAGINA; tentativa++) {
    const resp = await fetchImpl(url, { headers: { 'X-BI-Token': token } });
    if (resp.ok) return resp.json();
    if (tentativa === TENTATIVAS_POR_PAGINA) throw new Error(`guestsBI respondeu ${resp.status} após ${tentativa} tentativas`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (tentativa - 1)));
  }
}

async function buscarTodosOsGuests(token, fetchImpl) {
  let itens = [];
  let cursor = null;
  let pagina = 0;

  while (pagina < MAX_PAGINAS) {
    const inicio = Date.now();
    const url = cursor ? `${GUESTS_API_URL}?cursor=${encodeURIComponent(cursor)}` : GUESTS_API_URL;
    const corpo = await buscarPagina(url, token, fetchImpl);

    const daPagina = Array.isArray(corpo) ? corpo : (corpo.data || corpo.guests || corpo.items || []);
    itens = itens.concat(daPagina);

    const metadata = corpo.metadata || corpo;
    const cursorAnterior = cursor;
    cursor = metadata.nextCursor || metadata.cursor || null;
    const temMais = Boolean(metadata.hasMore) && Boolean(cursor) && cursor !== cursorAnterior;
    pagina += 1;

    console.log(`[guests] página ${pagina}: +${daPagina.length} (total ${itens.length}) em ${Date.now() - inicio}ms`);

    if (!temMais) return itens;
  }

  // Preferimos abortar (e manter a tabela antiga intacta) a fazer um
  // WRITE_TRUNCATE com carga incompleta.
  throw new Error(`guestsBI: atingiu o limite de ${MAX_PAGINAS} páginas sem terminar — abortando para não truncar com dados parciais`);
}

// customFields vem como {} em todo item observado — um struct vazio não tem
// tipo, e o autodetect do BigQuery rejeita a carga por causa disso. Como
// STRING, funciona independente do formato que vier (vazio hoje, populado no
// futuro).
function serializarLinha(item) {
  const { customFields, ...resto } = item;
  return JSON.stringify({ ...resto, customFields: JSON.stringify(customFields ?? {}) });
}

function carregarNaTabela(bq, itens) {
  return new Promise((resolve, reject) => {
    const tabela = bq.dataset('Presenciais', { projectId: 'leads-ts' }).table('Guests');
    const stream = tabela.createWriteStream({
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      writeDisposition: 'WRITE_TRUNCATE',
      autodetect: true,
    });
    stream.on('error', reject);
    stream.on('complete', () => resolve());
    for (const item of itens) stream.write(`${serializarLinha(item)}\n`);
    stream.end();
  });
}

export async function sincronizarGuests(deps = {}) {
  const token = deps.token ?? config.guestsBiToken;
  if (!token) throw new Error('GUESTS_BI_TOKEN não configurado');
  const fetchImpl = deps.fetch ?? fetch;
  const bq = deps.bq ?? new BigQuery({ projectId: config.projectId });

  const itens = await buscarTodosOsGuests(token, fetchImpl);
  // Tabela vazia é quase certamente falha da origem, não "zero guests" de
  // verdade — abortar em vez de truncar e perder a carga anterior.
  if (itens.length === 0) throw new Error('guestsBI devolveu 0 itens — abortando sem truncar a tabela');

  await carregarNaTabela(bq, itens);
  return { total: itens.length };
}
