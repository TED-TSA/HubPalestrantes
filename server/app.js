import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes.js';
import { runQuery } from './data/bq.js';
import { bancoPadrao } from './data/db.js';
import { comUsuario } from './auth/middleware.js';

export function criarApp(deps = {}) {
  const db = deps.db ?? bancoPadrao();
  const dependencias = { runQuery, ...deps, db };

  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const frontend = path.join(dir, '..', 'frontend');

  app.use(express.json());
  app.use(comUsuario(db));
  app.use('/api', criarRotas(dependencias));

  // As duas páginas se repelem: quem está logado não volta para o login, e quem
  // não está não vê o app. O frontend também confere via /api/eu, para cobrir
  // quem entrar por outra URL.
  app.get('/login', (req, res) => {
    if (req.usuario) return res.redirect('/');
    res.sendFile(path.join(frontend, 'login.html'));
  });
  app.get(['/', '/index.html'], (req, res) => {
    if (!req.usuario) return res.redirect('/login');
    res.sendFile(path.join(frontend, 'index.html'));
  });

  app.use(express.static(frontend, { index: false }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ erro: 'Falha ao consultar os dados' });
  });
  return app;
}
