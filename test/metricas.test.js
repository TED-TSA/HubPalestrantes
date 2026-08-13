import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enriquecerLeads, resumoEvento } from '../server/domain/metricas.js';

const raw = [
  { Nome: 'A', Telefone: '5549998033100', Email: 'a@x.com', PipelineName: 'Presencial Sorocaba', EtapaId: 'W53M', EtapaName: 'EM CONTATO', Conexao: 'Presencial Elizier' },
  { Nome: 'B', Telefone: '551190000000', Email: 'b@x.com', PipelineName: 'Presencial Sorocaba', EtapaId: 'U5v2', EtapaName: 'JÁ É ALDEIA', Conexao: null },
];

test('enriquece o lead com a etapa e o instrutor da Conexão', () => {
  const leads = enriquecerLeads(raw);
  assert.equal(leads[0].instrutor, 'Elizier');
  assert.equal(leads[0].instrutorSlug, 'elizier');
  assert.equal(leads[0].instrutorConhecido, true);
  assert.equal(leads[0].etapaName, 'EM CONTATO');
});

test('lead sem Conexão fica marcado como sem dono individual', () => {
  const leads = enriquecerLeads(raw);
  assert.equal(leads[1].instrutorConhecido, false);
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
