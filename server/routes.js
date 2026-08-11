import { Router } from 'express';
import * as repo from './data/repository.js';
import { runQuery } from './data/bq.js';

export function criarRotas(deps = { runQuery }) {
  const r = Router();
  r.get('/health', (_req, res) => res.json({ ok: true }));
  r.get('/eventos', async (_req, res, next) => {
    try { res.json(await repo.listarEventos(deps)); } catch (e) { next(e); }
  });
  r.get('/eventos/:slug', async (req, res, next) => {
    try {
      const d = await repo.detalheEvento(req.params.slug, deps);
      if (!d.evento) return res.status(404).json({ erro: 'Evento não encontrado' });
      res.json(d);
    } catch (e) { next(e); }
  });
  return r;
}
