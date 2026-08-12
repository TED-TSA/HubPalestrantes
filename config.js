export const config = {
  projectId: 'leads-ts',
  cacheTtlMs: 60_000,
  port: Number(process.env.PORT) || 3000,
  usarExemplo: process.env.USAR_EXEMPLO === '1',
  dbArquivo: process.env.DB_ARQUIVO || 'hub.db',
  dominioPermitido: 'tradestars.com.br',
  // Em produção atrás de HTTPS, defina COOKIE_SEGURO=1 para marcar o cookie como Secure.
  cookieSeguro: process.env.COOKIE_SEGURO === '1',
};
