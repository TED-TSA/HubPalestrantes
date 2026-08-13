export const config = {
  // As duas bases vivem em projetos diferentes, mas a service account
  // validator-bq-pipeline lê as duas — por isso a query roda faturando no
  // validator e referencia leads-ts por nome completo.
  projectId: 'validator-tradestars',
  // Uma leitura fria custa ~19s: são quatro consultas ao BigQuery pelo CLI, que
  // no Windows demora só para subir o processo. Com TTL de 60s, quem abrisse o
  // Hub um minuto depois de alguém pagava a espera inteira. As palestras são
  // históricas e os leads andam ao longo do dia — dez minutos é folgado.
  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 10 * 60_000,
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
