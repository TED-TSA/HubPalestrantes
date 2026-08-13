const store = new Map();

// Cada consulta ao BigQuery custa 11 a 16 segundos, e quase tudo é o tempo de
// subir o bq CLI — uma consulta que devolve 1 linha demora o mesmo que a de 439.
// Por isso, quando o prazo vence, servimos o valor antigo na hora e buscamos o
// novo por trás: ninguém fica esperando o relógio de outra pessoa virar.
export function cached(key, ttlMs, fn) {
  const agora = Date.now();
  const guardado = store.get(key);

  if (guardado) {
    if (agora - guardado.t < ttlMs) return guardado.p;
    if (!guardado.renovando) {
      guardado.renovando = true;
      Promise.resolve().then(fn)
        .then((valor) => store.set(key, { t: Date.now(), p: Promise.resolve(valor) }))
        .catch(() => { guardado.renovando = false; });
    }
    return guardado.p;
  }

  const p = Promise.resolve().then(fn).catch((e) => { store.delete(key); throw e; });
  store.set(key, { t: agora, p });
  return p;
}

export function limparCache() {
  store.clear();
}
