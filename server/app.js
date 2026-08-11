import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes.js';
import { runQuery } from './data/bq.js';

export function criarApp(deps = { runQuery }) {
  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  app.use('/api', criarRotas(deps));
  app.use(express.static(path.join(dir, '..', 'frontend')));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ erro: 'Falha ao consultar os dados' });
  });
  return app;
}
