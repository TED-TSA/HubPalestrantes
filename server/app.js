import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function criarApp() {
  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(dir, '..', 'frontend')));
  return app;
}
