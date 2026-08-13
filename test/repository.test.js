import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarEventos, detalheEvento, saude, nomesDeConexao } from '../server/data/repository.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, palestrasExemplo } from '../server/data/exemplo.js';

function fakeDeps() {
  return {
    runQuery: async (sql) => {
      if (sql.includes('presencial_metricas')) return palestrasExemplo;
      return leadsExemplo;
    },
  };
}

test('listarEventos vem da base de palestras, da mais recente para a mais antiga', async () => {
  limparCache();
  const eventos = await listarEventos(fakeDeps());
  assert.deepEqual(eventos.map((e) => e.cidade), ['Sorocaba', 'Ribeirão Preto', 'Uberlândia']);
  assert.deepEqual(eventos.map((e) => e.slug), [
    'sorocaba-2026-08-10', 'ribeirao-preto-2026-07-29', 'uberlandia-2026-07-27',
  ]);
});

test('a palestra traz presença e vendas da base de métricas, e os leads da outra', async () => {
  limparCache();
  const [sorocaba] = await listarEventos(fakeDeps());
  assert.equal(sorocaba.cadastrados, 1153);
  assert.equal(sorocaba.presentes, 90);
  assert.equal(sorocaba.vendas, 9);
  assert.equal(sorocaba.leads, 5, 'os cinco leads de Sorocaba');
  // pct_presentes vem multiplicado por 100 na origem.
  assert.equal(Math.round(sorocaba.pctPresenca * 1000) / 10, 7.8);
  assert.equal(Math.round(sorocaba.conversao * 100), 10);
});

test('lead sem Conexão pertence a quem subiu ao palco', async () => {
  limparCache();
  const d = await detalheEvento('ribeirao-preto-2026-07-29', fakeDeps());
  assert.deepEqual(d.instrutores.map((i) => i.instrutor), ['Elidiano', 'Elizier']);
  // Nenhum lead de Ribeirão tem Conexão, então os quatro contam para os dois.
  assert.equal(d.instrutores[0].total, 4);
  assert.equal(d.instrutores[1].total, 4);
});

test('as colunas seguem a ordem do funil, não o EtapaId', async () => {
  limparCache();
  const d = await detalheEvento('sorocaba-2026-08-10', fakeDeps());
  assert.deepEqual(d.colunas.map((c) => c.etapaName),
    ['EM CONTATO', 'PAGO TRIBO', 'JÁ É ALDEIA', 'SEM INTERESSE']);
});

test('palestra inexistente retorna evento null', async () => {
  limparCache();
  const d = await detalheEvento('nao-existe', fakeDeps());
  assert.equal(d.evento, null);
});

test('saude reporta os leads que a origem mandou quebrados', async () => {
  limparCache();
  const s = await saude(fakeDeps());
  assert.equal(s.descartados, 2);
  assert.equal(s.semPalestra, 0);
});

test('nomesDeConexao lista os palestrantes reais, separando a barra', async () => {
  limparCache();
  const nomes = await nomesDeConexao(fakeDeps());
  assert.deepEqual(nomes, ['Elidiano', 'Elizier']);
});
