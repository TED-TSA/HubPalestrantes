// Uma consulta a mais custa 11 segundos independentemente do que devolve, então
// a contagem dos descartados sai do SQL: vem tudo numa leitura só e o filtro
// acontece em JS. Ver server/data/cache.js para o porquê do custo.
// DataCheckin existe em info_leads desde 19/08/2026 (confirmado em 24/08/26:
// 1053 de 1138 linhas preenchidas) — plugada abaixo, como já estava previsto.
// O atendente (closer) já resolveu: sai de `Atendente`, coluna nova desde
// 18/08/2026.
// `eventName` é mais nova ainda (20/08/2026): código "[ddmm]SIGLA" que aponta
// a palestra exata, resolvendo o caso de cidade com mais de uma data
// (Balneário Camboriú). Um backfill em 20/08/2026 já preencheu boa parte do
// histórico (docs/dados-que-faltam.md, seção 5) cruzando por telefone contra
// leads-ts.Presenciais.Guests — mas a fonte mudou de novo no dia seguinte:
// desde 21/08/2026 o `PipelineName` passou a trazer o mesmo código embutido
// ("Presencial Balneário Camboriú - [1008] BAL"), formato fixo daqui pra
// frente. Não precisa de coluna nova pra isso — `PipelineName` já é
// selecionado abaixo. Ver parseCodigoEvento/resolverPorCodigoEvento/
// cidadeDoPipeline em server/domain/palestra.js, que leem os dois formatos.
export const SQL_LEADS = `
SELECT
  Nome, Email, Telefone, IdContato, PipelineId,
  TRIM(PipelineName) AS PipelineName,
  EtapaId,
  TRIM(EtapaName) AS EtapaName,
  TRIM(Palestrante) AS Palestrante,
  TRIM(Atendente) AS Atendente,
  TRIM(DataCheckin) AS DataCheckin,
  TRIM(eventName) AS EventName
FROM \`leads-ts.hub_uni.info_leads\`
`;

// Uma linha por palestra. É daqui que saem a data, o palestrante e os números
// de presença e venda — coisas que a base de leads não tem.
// Trocado de `validator-tradestars.tsflow` para `leads-ts.Presenciais` em
// 20/08/2026 (mesmo schema, mesmas 25 linhas de hoje). A `sigla` entrou junto:
// é a identidade do evento no `eventName` do lead (ver SQL_LEADS acima) —
// mas não é única sozinha, Balneário Camboriú usa "BC" nas duas datas que já
// teve, daí precisar também de `data_evento` pra desempatar.
// Corte em 01/07/2026 (combinado em 28/08/2026): eventos antes disso têm
// dado incompleto/poucas informações confiáveis — melhor não mostrar do que
// mostrar errado. Mexe aqui se o corte precisar andar pra frente.
export const SQL_PALESTRAS = `
SELECT
  TRIM(cidade) AS cidade,
  TRIM(sigla) AS sigla,
  TRIM(palestrante) AS palestrante,
  CAST(data_evento AS STRING) AS data_evento,
  cadastrados, checkin_geral, checkin_tribo, checkin_aldeia, checkin_lead,
  pct_presentes, vendas_total, vendas_a_pagar, cancelados, vendas_efetivas
FROM \`leads-ts.Presenciais.presencial_metricas\`
WHERE cidade IS NOT NULL
  AND data_evento >= DATE '2026-07-01'
ORDER BY data_evento DESC
`;
