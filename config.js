export const config = {
  projectId: 'leads-ts',
  cacheTtlMs: 60_000,
  port: Number(process.env.PORT) || 3000,
  usarExemplo: process.env.USAR_EXEMPLO === '1',
};
