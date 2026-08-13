import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarEventos, detalheEvento, saude, nomesDeConexao } from '../server/data/repository.js';
import { sincronizar } from '../server/data/sincronizacao.js';
import { abrirBanco } from '../server/data/db.js';
import { leadsExemplo, palestrasExemplo } from '../server/data/exemplo.js';

async function bancoCheio() {
  const db = abrirBanco(':memory:');
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasExemplo : leadsExemplo),
  });
  return db;
}

test('as palestras vêm da base de métricas, da mais recente para a mais antiga', async () => {
  const db = await bancoCheio();
  const eventos = listarEventos(db);
  assert.deepEqual(eventos.map((e) => e.cidade), ['Sorocaba', 'Ribeirão Preto', 'Uberlândia']);
  assert.deepEqual(eventos.map((e) => e.slug), [
    'sorocaba-2026-08-10', 'ribeirao-preto-2026-07-29', 'uberlandia-2026-07-27',
  ]);
});

test('a palestra traz presença e vendas da base de métricas, e os leads da outra', async () => {
  const db = await bancoCheio();
  const [sorocaba] = listarEventos(db);
  assert.equal(sorocaba.cadastrados, 1153);
  assert.equal(sorocaba.presentes, 90);
  assert.equal(sorocaba.vendas, 9);
  assert.equal(sorocaba.leads, 5);
  assert.equal(Math.round(sorocaba.pctPresenca * 1000) / 10, 7.8);
  assert.equal(Math.round(sorocaba.conversao * 100), 10);
});

test('lead sem Conexão pertence a quem subiu ao palco', async () => {
  const db = await bancoCheio();
  const d = detalheEvento(db, 'ribeirao-preto-2026-07-29');
  assert.deepEqual(d.instrutores.map((i) => i.instrutor), ['Elidiano', 'Elizier']);
  assert.equal(d.instrutores[0].total, 4);
  assert.equal(d.instrutores[1].total, 4);
});

test('as colunas seguem a ordem do funil, não o EtapaId', async () => {
  const db = await bancoCheio();
  const d = detalheEvento(db, 'sorocaba-2026-08-10');
  assert.deepEqual(d.colunas.map((c) => c.etapaName),
    ['EM CONTATO', 'PAGO TRIBO', 'JÁ É ALDEIA', 'SEM INTERESSE']);
});

test('palestra inexistente volta vazia', async () => {
  const db = await bancoCheio();
  assert.deepEqual(detalheEvento(db, 'nao-existe'), {});
});

test('o instrutor só enxerga a palestra em que subiu ao palco', async () => {
  const db = await bancoCheio();
  const marcos = { papel: 'instrutor', vinculos: ['Marcos'] };
  assert.deepEqual(listarEventos(db, marcos), []);
  assert.deepEqual(detalheEvento(db, 'sorocaba-2026-08-10', marcos), {});

  const elizier = { papel: 'instrutor', vinculos: ['Elizier'] };
  assert.deepEqual(listarEventos(db, elizier).map((e) => e.cidade), ['Sorocaba', 'Ribeirão Preto']);
});

test('saude reporta os leads que a origem mandou quebrados', async () => {
  const db = await bancoCheio();
  const s = saude(db);
  assert.equal(s.descartados, 2);
  assert.equal(s.semPalestra, 0);
  assert.ok(s.atualizadoEm, 'registra quando sincronizou');
});

test('nomesDeConexao lista os palestrantes reais, separando a barra', async () => {
  const db = await bancoCheio();
  assert.deepEqual(nomesDeConexao(db), ['Elidiano', 'Elizier']);
});

test('sincronizar de novo troca o conteúdo sem duplicar', async () => {
  const db = await bancoCheio();
  const antes = listarEventos(db).length;
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasExemplo : leadsExemplo),
  });
  assert.equal(listarEventos(db).length, antes);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 12);
});
