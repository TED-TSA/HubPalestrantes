import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../../config.js';

// Em máquina local, a autenticação vem do ADC do gcloud (Application Default
// Credentials) — não tem segredo no código. Na Vercel não existe metadata
// server nem `gcloud` logado, então a service account `validator-bq-pipeline`
// (BigQuery Job User em validator-tradestars, BigQuery Data Viewer em
// leads-ts) precisa ser passada explicitamente via GOOGLE_APPLICATION_CREDENTIALS_JSON
// (o conteúdo inteiro da chave .json, numa env var — a Vercel não tem
// filesystem persistente pra apontar um caminho de arquivo).
//
// O projectId define só onde o job é faturado. As tabelas são referenciadas
// pelo nome completo (`leads-ts...`, `validator-tradestars...`), então uma
// query só cruza os dois projetos.
const opcoesBq = { projectId: config.projectId };
if (config.googleCredenciaisJson) {
  opcoesBq.credentials = JSON.parse(config.googleCredenciaisJson);
}
const bq = new BigQuery(opcoesBq);

// Antes isto chamava o `bq` CLI via spawn e precisava consertar o JSON que o
// Python emitia (emoji com escape \U, acento na codepage do console). A
// biblioteca devolve objetos JS já decodificados, então esses remendos saíram.
export async function runQuery(sql, params = []) {
  const opcoes = { query: sql };
  // Nenhuma consulta atual passa parâmetro, mas a interface segue igual: um
  // array de { name, type, value } vira os parâmetros nomeados da query.
  if (params.length) {
    opcoes.params = Object.fromEntries(params.map((p) => [p.name, p.value]));
    opcoes.types = Object.fromEntries(params.map((p) => [p.name, p.type]));
  }
  const [linhas] = await bq.query(opcoes);
  return linhas;
}
