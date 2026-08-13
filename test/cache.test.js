import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached, limparCache } from '../server/data/cache.js';

test('cache reaproveita resultado dentro do TTL', async () => {
  limparCache();
  let chamadas = 0;
  const fn = async () => { chamadas++; return 42; };
  const a = await cached('k', 10_000, fn);
  const b = await cached('k', 10_000, fn);
  assert.equal(a, 42);
  assert.equal(b, 42);
  assert.equal(chamadas, 1);
});

test('cache expira após TTL', async () => {
  limparCache();
  let chamadas = 0;
  const fn = async () => { chamadas++; return chamadas; };
  await cached('k', 0, fn);
  await new Promise((r) => setTimeout(r, 1));
  await cached('k', 0, fn);
  assert.equal(chamadas, 2);
});

test('depois do prazo, devolve o valor velho na hora e renova por trás', async () => {
  limparCache();
  let chamadas = 0;
  const lento = async () => {
    chamadas += 1;
    if (chamadas > 1) await new Promise((r) => setTimeout(r, 60));
    return `v${chamadas}`;
  };

  assert.equal(await cached('k', 10, lento), 'v1');
  await new Promise((r) => setTimeout(r, 20)); // prazo vence

  const inicio = Date.now();
  const durante = await cached('k', 10, lento);
  const espera = Date.now() - inicio;

  assert.equal(durante, 'v1', 'serve o valor velho sem esperar');
  assert.ok(espera < 30, `não deveria bloquear (esperou ${espera}ms)`);
  assert.equal(chamadas, 2, 'disparou a renovação por trás');

  await new Promise((r) => setTimeout(r, 120));
  assert.equal(await cached('k', 10_000, lento), 'v2', 'depois entrega o novo');
});

test('a renovação não é disparada duas vezes em paralelo', async () => {
  limparCache();
  let chamadas = 0;
  const fn = async () => { chamadas += 1; await new Promise((r) => setTimeout(r, 40)); return chamadas; };
  await cached('p', 10, fn);
  await new Promise((r) => setTimeout(r, 20));
  await Promise.all([cached('p', 10, fn), cached('p', 10, fn), cached('p', 10, fn)]);
  assert.equal(chamadas, 2, 'uma leitura inicial e uma renovação só');
});
