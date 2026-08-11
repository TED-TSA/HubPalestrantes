import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../server/app.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, vendasExemplo } from '../server/data/exemplo.js';

function subir() {
  limparCache();
  const deps = { runQuery: async (sql) => sql.includes('info_leads') ? leadsExemplo : vendasExemplo };
  const app = criarApp(deps);
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, base: `http://localhost:${srv.address().port}` }));
  });
}

test('GET /api/eventos retorna lista', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body) && body.length === 2);
  srv.close();
});

test('GET /api/eventos/:slug retorna detalhe', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos/cxj-3006`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.evento, 'CXJ 3006');
  srv.close();
});

test('GET /api/eventos/:slug inexistente retorna 404', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos/nao-existe`);
  assert.equal(res.status, 404);
  srv.close();
});
