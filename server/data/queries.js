// O pipeline que alimenta info_leads grava ausência como a PALAVRA "null", não
// como NULL de banco — 171 das 308 linhas na primeira carga. Por isso o filtro
// compara texto: `IS NOT NULL` deixaria tudo passar.
const NAO_E_NULO = (col) => `LOWER(TRIM(COALESCE(${col}, 'null'))) NOT IN ('null', '')`;

export const SQL_LEADS = `
SELECT
  Nome, Email, Telefone, IdContato, PipelineId,
  TRIM(PipelineName) AS PipelineName,
  EtapaId,
  TRIM(EtapaName) AS EtapaName,
  CASE WHEN ${NAO_E_NULO('Conexao')} THEN TRIM(Conexao) END AS Conexao
FROM \`leads-ts.hub_uni.info_leads\`
WHERE ${NAO_E_NULO('PipelineName')}
  AND ${NAO_E_NULO('EtapaName')}
`;

// Quantos ficaram de fora, para a gestão poder cobrar a origem em vez de
// descobrir meses depois que metade dos leads nunca apareceu.
export const SQL_LEADS_DESCARTADOS = `
SELECT
  COUNT(*) AS total,
  COUNTIF(NOT (${NAO_E_NULO('PipelineName')}) OR NOT (${NAO_E_NULO('EtapaName')})) AS descartados
FROM \`leads-ts.hub_uni.info_leads\`
`;

// Uma linha por palestra. É daqui que saem a data, o palestrante e os números
// de presença — coisas que a base de leads não tem.
export const SQL_PALESTRAS = `
SELECT
  TRIM(cidade) AS cidade,
  TRIM(palestrante) AS palestrante,
  CAST(data_evento AS STRING) AS data_evento,
  cadastrados, checkin_geral, checkin_tribo, checkin_aldeia, checkin_lead,
  pct_presentes, vendas_total, vendas_a_pagar, cancelados, vendas_efetivas
FROM \`validator-tradestars.tsflow.presencial_metricas\`
WHERE cidade IS NOT NULL
ORDER BY data_evento DESC
`;

