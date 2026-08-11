export const SQL_LEADS = `
SELECT Nome, Email, Telefone, IdContato, PipelineId, PipelineName, EtapaId, EtapaName, Conexao
FROM \`leads-ts.hub_uni.info_leads\`
`;

export const SQL_VENDAS = `
SELECT person_phone, person_email, curso_comprado, valor_pago,
       CAST(data_venda_brt AS STRING) AS data_venda, Equipe
FROM (
  SELECT person_phone, person_email, curso_comprado, valor_pago, data_venda_brt, Equipe,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(person_id, 0) ORDER BY data_venda_brt DESC) rn
  FROM \`leads-ts.pipedrive_rt.vw_ald_trb_gold\`
  WHERE COALESCE(is_cancelled_flag, false) = false
)
WHERE rn = 1
`;
