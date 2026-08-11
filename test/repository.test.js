import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarEventos, detalheEvento } from '../server/data/repository.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, vendasExemplo } from '../server/data/exemplo.js';

function fakeDeps() {
  return {
    runQuery: async (sql) =>
      sql.includes('info_leads') ? leadsExemplo : vendasExemplo,
  };
}

test('listarEventos agrupa por PipelineName com métricas', async () => {
  limparCache();
  const eventos = await listarEventos(fakeDeps());
  const nomes = eventos.map((e) => e.evento).sort();
  assert.deepEqual(nomes, ['CXJ 3006', 'SP 4010']);
  const cxj = eventos.find((e) => e.evento === 'CXJ 3006');
  assert.equal(cxj.total, 7);
  // Brief especificava 2; com os fixtures de exemplo.js e a logica de
  // cruzamento ja implementada/revisada (Task 5), Herika, Joao Pedro e
  // Bruna Reis batem por telefone com vendasExemplo => 3 vendas reais.
  assert.equal(cxj.vendas, 3);
});

test('detalheEvento traz instrutores e colunas', async () => {
  limparCache();
  const d = await detalheEvento('cxj-3006', fakeDeps());
  assert.equal(d.evento, 'CXJ 3006');
  assert.ok(d.instrutores.length >= 2);
  assert.ok(d.colunas.length >= 3);
});

test('detalheEvento inexistente retorna evento null', async () => {
  limparCache();
  const d = await detalheEvento('nao-existe', fakeDeps());
  assert.equal(d.evento, null);
});
