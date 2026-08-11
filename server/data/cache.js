const store = new Map();

export function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.t < ttlMs) return hit.p;
  const p = Promise.resolve().then(fn).catch((e) => { store.delete(key); throw e; });
  store.set(key, { t: now, p });
  return p;
}

export function limparCache() {
  store.clear();
}
