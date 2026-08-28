import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enriquecerLeads, resumoEvento, deduplicarLeads } from '../server/domain/metricas.js';

const raw = [
  { Nome: 'A', Telefone: '5549998033100', Email: 'a@x.com', PipelineName: 'Presencial Sorocaba', EtapaId: 'W53M', EtapaName: 'EM CONTATO', Palestrante: 'Elizier' },
  { Nome: 'B', Telefone: '551190000000', Email: 'b@x.com', PipelineName: 'Presencial Sorocaba', EtapaId: 'U5v2', EtapaName: 'JÁ É ALDEIA', Palestrante: null },
];

test('enriquece o lead com a etapa e os palestrantes de Palestrante', () => {
  const leads = enriquecerLeads(raw);
  assert.deepEqual(leads[0].palestrantes, ['Elizier']);
  assert.equal(leads[0].etapaName, 'EM CONTATO');
});

test('lead com mais de um palestrante em Palestrante traz os dois', () => {
  const leads = enriquecerLeads([
    { ...raw[0], Palestrante: 'Elidiano / Elizier' },
  ]);
  assert.deepEqual(leads[0].palestrantes, ['Elidiano', 'Elizier']);
});

test('lead sem Palestrante fica sem atribuição própria (null)', () => {
  const leads = enriquecerLeads(raw);
  assert.equal(leads[1].palestrantes, null);
});

test('closer sai do campo Atendente', () => {
  const leads = enriquecerLeads([{ ...raw[0], Atendente: 'Bruna Nogueira' }]);
  assert.equal(leads[0].closer, 'Bruna Nogueira');
});

test('sem Atendente, closer fica null', () => {
  const leads = enriquecerLeads(raw);
  assert.equal(leads[0].closer, null);
});

test('Atendente com a palavra "null" também vira closer null', () => {
  const leads = enriquecerLeads([{ ...raw[0], Atendente: 'null' }]);
  assert.equal(leads[0].closer, null);
});

test('o lead não carrega mais venda: isso vem da base da palestra', () => {
  const l = enriquecerLeads(raw)[0];
  assert.equal(l.vendeu, undefined);
  assert.equal(l.curso, undefined);
  assert.equal(l.valorPago, undefined);
});

test('resumoEvento conta os leads', () => {
  assert.deepEqual(resumoEvento(enriquecerLeads(raw)), { total: 2 });
});

const lead = (extra = {}) => ({
  nome: 'Cris Beltrão', telefone: '552299808', email: null, etapaName: 'EM CONTATO', checkinEm: null, ...extra,
});

test('duas cópias do mesmo lead (mesmo nome+telefone+email+etapa) viram uma', () => {
  const itens = [['sorocaba-2026-08-10', lead()], ['sorocaba-2026-08-10', lead()]];
  assert.equal(deduplicarLeads(itens).length, 1);
});

test('sem check-in em nenhuma cópia, fica uma (qualquer)', () => {
  const itens = [['sorocaba-2026-08-10', lead()], ['sorocaba-2026-08-10', lead()]];
  const [[, restante]] = deduplicarLeads(itens);
  assert.equal(restante.nome, 'Cris Beltrão');
});

test('entre duas cópias, fica a de check-in mais recente', () => {
  const itens = [
    ['sorocaba-2026-08-10', lead({ checkinEm: '2026-08-01' })],
    ['sorocaba-2026-08-10', lead({ checkinEm: '2026-08-10' })],
    ['sorocaba-2026-08-10', lead({ checkinEm: null })],
  ];
  const [[, restante]] = deduplicarLeads(itens);
  assert.equal(restante.checkinEm, '2026-08-10');
});

test('mesmo nome+telefone em palestras diferentes NÃO é duplicata', () => {
  const itens = [['sorocaba-2026-08-10', lead()], ['ribeirao-preto-2026-07-29', lead()]];
  assert.equal(deduplicarLeads(itens).length, 2);
});

test('etapas diferentes para a mesma pessoa não são fundidas', () => {
  const itens = [
    ['sorocaba-2026-08-10', lead({ etapaName: 'EM CONTATO' })],
    ['sorocaba-2026-08-10', lead({ etapaName: 'NEGOCIANDO' })],
  ];
  assert.equal(deduplicarLeads(itens).length, 2);
});
