import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarEventos, detalheEvento, saude, nomesDePalestrante } from '../server/data/repository.js';
import { sincronizar } from '../server/data/sincronizacao.js';
import { abrirBanco } from '../server/data/db.js';
import { leadsExemplo, palestrasExemplo } from '../server/data/exemplo.js';
import { config } from '../config.js';

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

test('lead com Palestrante de dois nomes pertence aos dois juntos', async () => {
  const db = await bancoCheio();
  const d = detalheEvento(db, 'ribeirao-preto-2026-07-29');
  assert.deepEqual(d.instrutores.map((i) => i.instrutor), ['Elidiano', 'Elizier']);
  assert.equal(d.instrutores[0].total, 4);
  assert.equal(d.instrutores[1].total, 4);
});

test('o quadro do evento traz o funil inteiro, na ordem do funil', async () => {
  const db = await bancoCheio();
  const d = detalheEvento(db, 'sorocaba-2026-08-10');
  assert.deepEqual(d.colunas.map((c) => c.etapaName), config.ordemEtapas);
});

test('os leads do evento caem cada um na sua etapa', async () => {
  const db = await bancoCheio();
  const d = detalheEvento(db, 'sorocaba-2026-08-10');
  const porEtapa = new Map(d.colunas.map((c) => [c.etapaName, c.leads.length]));
  assert.equal(porEtapa.get('EM CONTATO'), 2);
  assert.equal(porEtapa.get('PAGO TRIBO'), 1);
  assert.equal(porEtapa.get('JÁ É ALDEIA'), 1);
  assert.equal(porEtapa.get('SEM INTERESSE'), 1);
  // Etapa sem lead continua no quadro, e é isso que o torna um kanban.
  assert.equal(porEtapa.get('MENTORIA'), 0);
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
  assert.equal(s.duplicados, 0);
  assert.ok(s.atualizadoEm, 'registra quando sincronizou');
});

test('nomesDePalestrante lista os palestrantes reais, separando a barra', async () => {
  const db = await bancoCheio();
  assert.deepEqual(nomesDePalestrante(db), ['Elidiano', 'Elizier']);
});

// O caso de verdade que motivou o eventName: Balneário Camboriú teve palestra
// em 20/05 e 10/08, e sem código todo lead da cidade cai na mais recente.
test('eventName com sigla+data manda pro evento certo, onde a cidade sozinha erraria', async () => {
  const palestrasRaw = [
    { cidade: 'Balneário Camboriú', sigla: 'BC', palestrante: 'Elidiano', data_evento: '2026-05-20',
      cadastrados: 100, checkin_geral: 10, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 8,
      pct_presentes: 10, vendas_total: 1, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 1 },
    { cidade: 'Balneário Camboriú', sigla: 'BC', palestrante: 'Elidiano', data_evento: '2026-08-10',
      cadastrados: 200, checkin_geral: 20, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 15,
      pct_presentes: 10, vendas_total: 2, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 2 },
  ];
  const leadsRaw = [
    { Nome: 'Sem código', Email: null, Telefone: null, PipelineId: '1',
      PipelineName: 'Presencial Balneário Camboriú', EtapaId: 'e1', EtapaName: 'EM CONTATO',
      Palestrante: null, Atendente: null, EventName: null },
    { Nome: 'Com código', Email: null, Telefone: null, PipelineId: '1',
      PipelineName: 'Presencial Balneário Camboriú', EtapaId: 'e1', EtapaName: 'EM CONTATO',
      Palestrante: null, Atendente: null, EventName: '[2005]BC' },
  ];
  const db = abrirBanco(':memory:');
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasRaw : leadsRaw),
  });
  const semCodigo = db.prepare('SELECT palestra_slug FROM leads WHERE nome = ?').get('Sem código');
  const comCodigo = db.prepare('SELECT palestra_slug FROM leads WHERE nome = ?').get('Com código');
  // Sem eventName, cai no fallback de sempre: aposta na palestra mais recente.
  assert.equal(semCodigo.palestra_slug, 'balneario-camboriu-2026-08-10');
  // Com o código, vai pra data certa — mesmo sendo a mais antiga das duas.
  assert.equal(comCodigo.palestra_slug, 'balneario-camboriu-2026-05-20');
});

// Formato fixo a partir de 21/08/2026: o código não vem mais solto em
// eventName, vem embutido no próprio PipelineName.
test('código embutido no PipelineName resolve sem precisar de eventName', async () => {
  const palestrasRaw = [
    { cidade: 'Balneário Camboriú', sigla: 'BC', palestrante: 'Elidiano', data_evento: '2026-05-20',
      cadastrados: 100, checkin_geral: 10, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 8,
      pct_presentes: 10, vendas_total: 1, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 1 },
    { cidade: 'Balneário Camboriú', sigla: 'BC', palestrante: 'Elidiano', data_evento: '2026-08-10',
      cadastrados: 200, checkin_geral: 20, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 15,
      pct_presentes: 10, vendas_total: 2, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 2 },
  ];
  const leadsRaw = [
    { Nome: 'PipelineName novo', Email: null, Telefone: null, PipelineId: '1',
      PipelineName: 'Presencial Balneário Camboriú - [2005] BC', EtapaId: 'e1', EtapaName: 'EM CONTATO',
      Palestrante: null, Atendente: null, EventName: null },
  ];
  const db = abrirBanco(':memory:');
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasRaw : leadsRaw),
  });
  const lead = db.prepare('SELECT palestra_slug FROM leads WHERE nome = ?').get('PipelineName novo');
  assert.equal(lead.palestra_slug, 'balneario-camboriu-2026-05-20');
});

// Achado em 28/08/2026: contato passou por Palmas antes de virar lead de
// Blumenau, e o `eventName` ficou com o resíduo da campanha antiga (Palmas)
// mesmo o negócio já estando no pipeline certo (Blumenau). Checar eventName
// primeiro roubava ~100 leads de Blumenau pro card de Palmas.
test('PipelineName vence eventName desatualizado de outra cidade', async () => {
  const palestrasRaw = [
    { cidade: 'Blumenau', sigla: 'BLU', palestrante: 'Elidiano', data_evento: '2026-08-24',
      cadastrados: 100, checkin_geral: 10, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 8,
      pct_presentes: 10, vendas_total: 1, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 1 },
    { cidade: 'Palmas', sigla: 'PAL', palestrante: 'Elizier', data_evento: '2026-08-24',
      cadastrados: 50, checkin_geral: 5, checkin_tribo: 0, checkin_aldeia: 0, checkin_lead: 3,
      pct_presentes: 10, vendas_total: 1, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 1 },
  ];
  const leadsRaw = [
    { Nome: 'Contaminado', Email: null, Telefone: null, PipelineId: '1',
      PipelineName: 'Presencial Blumenau - [2408]  BLU', EtapaId: 'e1', EtapaName: 'EM CONTATO',
      Palestrante: null, Atendente: null, EventName: '[2408] PAL' },
  ];
  const db = abrirBanco(':memory:');
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasRaw : leadsRaw),
  });
  const lead = db.prepare('SELECT palestra_slug FROM leads WHERE nome = ?').get('Contaminado');
  assert.equal(lead.palestra_slug, 'blumenau-2026-08-24');
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

// A origem manda a mesma pessoa mais de uma vez às vezes — de ponta a ponta,
// não só a função pura: a linha repetida não pode virar dois leads na tela.
test('lead que a origem manda repetido conta como um só, de ponta a ponta', async () => {
  const db = abrirBanco(':memory:');
  const repetido = leadsExemplo[0]; // Hérika Rodrigues, Sorocaba, EM CONTATO
  const leadsComRepeticao = [...leadsExemplo, { ...repetido }, { ...repetido }];
  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasExemplo : leadsComRepeticao),
  });

  const d = detalheEvento(db, 'sorocaba-2026-08-10');
  const emContato = d.colunas.find((c) => c.etapaName === 'EM CONTATO');
  assert.equal(emContato.leads.filter((l) => l.nome === 'Hérika Rodrigues').length, 1);

  const s = saude(db);
  assert.equal(s.duplicados, 2, 'as duas cópias extras contam como descartadas por duplicação');
});
