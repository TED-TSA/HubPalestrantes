// Uma consulta a mais custa 11 segundos independentemente do que devolve, então
// a contagem dos descartados sai do SQL: vem tudo numa leitura só e o filtro
// acontece em JS. Ver server/data/cache.js para o porquê do custo.
export const SQL_LEADS = `
SELECT
  Nome, Email, Telefone, IdContato, PipelineId,
  TRIM(PipelineName) AS PipelineName,
  EtapaId,
  TRIM(EtapaName) AS EtapaName,
  TRIM(Conexao) AS Conexao
FROM \`leads-ts.hub_uni.info_leads\`
`;

// Uma linha por palestra. É daqui que saem a data, o palestrante e os números
// de presença e venda — coisas que a base de leads não tem.
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
