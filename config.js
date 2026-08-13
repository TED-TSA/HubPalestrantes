export const config = {
  // As duas bases vivem em projetos diferentes, mas a service account
  // validator-bq-pipeline lê as duas — por isso a query roda faturando no
  // validator e referencia leads-ts por nome completo.
  projectId: 'validator-tradestars',
  cacheTtlMs: 60_000,
  port: Number(process.env.PORT) || 3000,
  usarExemplo: process.env.USAR_EXEMPLO === '1',
  dbArquivo: process.env.DB_ARQUIVO || 'hub.db',
  dominioPermitido: 'tradestars.com.br',
  // Em produção atrás de HTTPS, defina COOKIE_SEGURO=1 para marcar o cookie como Secure.
  cookieSeguro: process.env.COOKIE_SEGURO === '1',

  // EtapaId é um hash, não uma sequência: não dá para ordenar o funil por ele.
  // Esta é a ordem de negócio; etapa que não estiver aqui vai para o fim.
  ordemEtapas: [
    'EM CONTATO',
    'MENTORIA',
    'PAGO TRIBO',
    'JÁ É ALDEIA',
    'JÁ É MEMBRO',
    'SEM INTERESSE',
  ],
};
