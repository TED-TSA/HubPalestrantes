import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../../config.js';

// A autenticação vem do ambiente (Application Default Credentials): no Cloud Run
// é a service account do serviço; em máquina local é o ADC do gcloud. Nenhum
// segredo no código.
//
// O projectId define só onde o job é faturado. As tabelas são referenciadas
// pelo nome completo (`leads-ts...`, `validator-tradestars...`), então uma
// query só cruza os dois projetos.
const bq = new BigQuery({ projectId: config.projectId });

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
