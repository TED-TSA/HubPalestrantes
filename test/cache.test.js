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
