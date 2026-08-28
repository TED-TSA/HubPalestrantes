import { slug } from './texto.js';

// "Elidiano / Elizier" → ['Elidiano', 'Elizier']. Uma palestra pode ter mais de
// um palestrante no palco, separados por barra.
export function separarPalestrantes(campo) {
  return String(campo ?? '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
}

const numero = (v) => (v === null || v === undefined ? 0 : Number(v));

// Uma linha de presencial_metricas vira uma palestra. A identidade é cidade +
// data: a mesma cidade pode receber duas palestras (Balneário Camboriú teve
// 20/05 e 10/08).
export function montarPalestra(linha) {
  const cidade = String(linha.cidade ?? '').trim();
  const data = String(linha.data_evento ?? '').trim();
  const presentes = numero(linha.checkin_geral);
  const vendas = numero(linha.vendas_efetivas);
  const vendasTotais = numero(linha.vendas_total);
  return {
    cidade,
    data,
    // Sigla própria da palestra (ex.: "UDI", "BH") — vem de
    // leads-ts.Presenciais.presencial_metricas desde 20/08/2026. Não é única
    // sozinha (Balneário Camboriú usa "BC" nas duas datas que já teve); ver
    // resolverPorCodigoEvento, que desempata por data quando precisa.
    sigla: String(linha.sigla ?? '').trim(),
    slug: `${slug(cidade)}-${data}`,
    palestrantes: separarPalestrantes(linha.palestrante),
    cadastrados: numero(linha.cadastrados),
    presentes,
    presentesTribo: numero(linha.checkin_tribo),
    presentesAldeia: numero(linha.checkin_aldeia),
    presentesLead: numero(linha.checkin_lead),
    // pct_presentes já vem multiplicado por 100 na origem (7.8 = 7,8%).
    pctPresenca: numero(linha.pct_presentes) / 100,
    vendasTotais,
    vendasAPagar: numero(linha.vendas_a_pagar),
    canceladas: numero(linha.cancelados),
    vendas,
    // Vender para quem esteve na sala é a taxa que importa numa palestra, e a
    // base é a venda total: cancelamento e pagamento pendente são história
    // posterior, e descontá-los fazia o número da palestra piorar depois de o
    // evento ter acabado. As efetivas continuam à vista no bloco de vendas.
    conversao: presentes ? vendasTotais / presentes : 0,
  };
}

// O nome do funil vem como "Presencial Ribeirão Preto"; a base de métricas
// guarda só "Ribeirão Preto". É por aqui que as duas se encontram.
// Desde 21/08/2026 o PipelineName passou a trazer o código do evento junto
// ("Presencial Balneário Camboriú - [1008] BAL") — corta a partir do " - "
// pra sobrar só a cidade, senão o fallback por cidade quebra pra quem já vem
// no formato novo (ver parseCodigoEvento, que lê o código dessa mesma string).
export function cidadeDoPipeline(pipelineName) {
  return String(pipelineName ?? '').replace(/^\s*presencial\s+/i, '').split(' - ')[0].trim();
}

// Leads não têm data, então uma cidade com duas palestras não tem como ser
// desempatada. Vão para a mais recente, que é a aposta certa para lead em
// aberto — quem ainda está sendo trabalhado veio do evento que acabou de ocorrer.
export function indexarPalestrasPorCidade(palestras) {
  const porCidade = new Map();
  for (const p of palestras) {
    const chave = slug(p.cidade);
    const atual = porCidade.get(chave);
    if (!atual || p.data > atual.data) porCidade.set(chave, p);
  }
  return porCidade;
}

// O código "[ddmm]SIGLA" identifica o evento sem ambiguidade — sigla como
// identidade, dia/mês como desempate (ver resolverPorCodigoEvento). Aparece em
// dois lugares: na coluna `eventName` de info_leads (20/08/2026, upload de
// histórico, formato solto — às vezes sem colchete, às vezes com mais coisa
// depois de uma barra, ex.: "[0108] SP/JAC" onde "JAC" é o instrutor) e, desde
// 21/08/2026, dentro do próprio `PipelineName` ("Presencial Balneário
// Camboriú - [1008] BAL") — esse é o formato daqui pra frente, e é fixo.
// Não ancorado no começo da string de propósito: assim a mesma função lê os
// dois formatos, o solto e o embutido depois do nome da cidade.
export function parseCodigoEvento(eventName) {
  const m = String(eventName ?? '').trim().match(/\[?(\d{2})(\d{2})\]?\s*([^\s/]+)/);
  if (!m) return null;
  return { dia: Number(m[1]), mes: Number(m[2]), sigla: m[3].toUpperCase() };
}

// O inverso: gera o código a partir de uma palestra já resolvida (data +
// sigla), no formato canônico "[ddmm]SIGLA" — para escrever de volta, não pra
// copiar cru o que a origem mandou (que já mostrou grafia inconsistente,
// como "Balneário" em vez de "BC" para o mesmo evento).
export function formatarCodigoEvento(palestra) {
  const m = palestra.data.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m || !palestra.sigla) return null;
  const [, mes, dia] = m;
  return `[${dia}${mes}]${palestra.sigla.toUpperCase()}`;
}

// Sigla não é única sozinha: Balneário Camboriú usa "BC" nas duas datas que
// já teve. Por isso o índice guarda uma lista por sigla, não uma palestra só.
export function indexarPalestrasPorSigla(palestras) {
  const porSigla = new Map();
  for (const p of palestras) {
    if (!p.sigla) continue;
    const chave = p.sigla.toUpperCase();
    if (!porSigla.has(chave)) porSigla.set(chave, []);
    porSigla.get(chave).push(p);
  }
  return porSigla;
}

// Sem ano no código, então a distância usa um ano de referência qualquer —
// funciona porque nenhuma palestra de hoje cruza virada de ano.
function distanciaEmDias(mesA, diaA, mesB, diaB) {
  const A = new Date(2000, mesA - 1, diaA);
  const B = new Date(2000, mesB - 1, diaB);
  return Math.abs(A - B) / 86400000;
}

// Tolerância pedida porque o evento dura mais de um dia: o `[ddmm]` do lead e
// a `data_evento` da palestra não são garantidos bater no mesmo dia exato (visto
// na base real: Manaus registrado como 03/06 em presencial_metricas, e como
// "[0406]MAN" — 04/06 — no primeiro lead com a coluna preenchida).
const TOLERANCIA_DIAS = 5;

// Resolve pela sigla primeiro. Com uma palestra só pra aquela sigla, é ela —
// não checa data, porque a sigla já é a identidade (e é o próprio caso Manaus
// acima: a data diverge um pouco e ainda assim é a palestra certa). Com mais
// de uma (hoje, só Balneário Camboriú), a tolerância de dias é quem desempata.
export function resolverPorCodigoEvento(codigo, porSigla) {
  if (!codigo) return null;
  const candidatas = porSigla.get(codigo.sigla);
  if (!candidatas?.length) return null;
  if (candidatas.length === 1) return candidatas[0];

  let melhor = null;
  let menorDistancia = Infinity;
  for (const p of candidatas) {
    const [, ano, mes, dia] = p.data.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    if (!ano) continue;
    const distancia = distanciaEmDias(codigo.mes, codigo.dia, Number(mes), Number(dia));
    if (distancia < menorDistancia) { menorDistancia = distancia; melhor = p; }
  }
  return menorDistancia <= TOLERANCIA_DIAS ? melhor : null;
}
