export const config = {
  // As duas consultas (leads e palestras) leem tabelas do projeto leads-ts,
  // mas o job roda faturando no validator-tradestars — a service account
  // validator-bq-pipeline lê os dois, e a query referencia leads-ts por nome
  // completo.
  projectId: 'validator-tradestars',
  // Chave da service account do BigQuery, como JSON inteiro numa env var (a
  // Vercel não tem filesystem persistente nem ADC do gcloud). Sem ela, cai no
  // ADC local — ver server/data/bq.js.
  googleCredenciaisJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  // De quanto em quanto tempo o espelho local é atualizado a partir do
  // BigQuery. A tela nunca espera por isso: lê do SQLite. As palestras são
  // históricas e os leads andam ao longo do dia, então 15 minutos sobra.
  sincronizacaoMs: Number(process.env.SYNC_MS) || 15 * 60_000,
  port: Number(process.env.PORT) || 3000,
  usarExemplo: process.env.USAR_EXEMPLO === '1',
  // Token da esteira guestsBI (leads-ts.Presenciais.Guests). Sem segredo no
  // código — ver server/data/guests.js e scripts/sincronizar-guests.js.
  guestsBiToken: process.env.GUESTS_BI_TOKEN,
  // Token da UnniAPI (CRM do Unnichat). Ver server/data/pipelinesUnnichat.js
  // (mapa pipeline/coluna) e server/data/reconciliarUnnichat.js.
  unnichatToken: process.env.UNNICHAT_TOKEN,
  dbArquivo: process.env.DB_ARQUIVO || 'hub.db',
  // Turso (libSQL hospedado) em produção; sem as duas variáveis, cai no
  // arquivo local (dev) — ver server/data/db.js.
  tursoUrl: process.env.TURSO_DATABASE_URL,
  tursoToken: process.env.TURSO_AUTH_TOKEN,
  dominioPermitido: 'tradestars.com.br',
  // Em produção atrás de HTTPS, defina COOKIE_SEGURO=1 para marcar o cookie como Secure.
  cookieSeguro: process.env.COOKIE_SEGURO === '1',

  // EtapaId é um hash, não uma sequência: não dá para ordenar o funil por ele.
  // Esta é a ordem de negócio, e também a lista do que o quadro mostra: toda
  // etapa daqui vira coluna, com lead ou sem. Etapa que aparecer nos dados sem
  // estar aqui entra no fim, em ordem alfabética, para não sumir da tela.
  //
  // A lista saiu das etapas que a origem realmente usa (`SELECT DISTINCT
  // EtapaName FROM leads-ts.hub_uni.info_leads`). A ordem é a do funil e é o
  // único lugar para mexer nela.
  ordemEtapas: [
    'EM CONTATO',
    'HORÁRIO AGENDADO',
    'NEGOCIANDO',
    'MENTORIA',
    'A PAGAR TRIBO',
    'PAGO TRIBO',
    'PAGO ALDEIA',
    'PAGO NO EVENTO',
    'JÁ É ALDEIA',
    'JÁ É MEMBRO',
    'NÃO COMPARECEU',
    'SEM CONDIÇÕES',
    'SEM INTERESSE',
  ],
};
