import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enriquecerLeads, resumoEvento, resumoInstrutores } from '../server/domain/metricas.js';
import { indexarVendas } from '../server/domain/vendas.js';

const raw = [
  { Nome: 'A', Telefone: '5549998033100', Email: 'a@x.com', PipelineName: 'CXJ 3006', EtapaId: '1', EtapaName: 'Novo', Conexao: 'Presencial Elidiano' },
  { Nome: 'B', Telefone: '551190000000', Email: 'b@x.com', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Elidiano' },
  { Nome: 'C', Telefone: '551190000001', Email: 'c@x.com', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Online Ana' },
];
const vendas = [{ person_phone: '5549998033100', person_email: 'a@x.com', curso_comprado: 'Curso A', valor_pago: 697, data_venda: '2026-08-01', Equipe: 'Bruno' }];

test('enriquece leads com instrutor e venda', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  assert.equal(leads[0].instrutor, 'Elidiano');
  assert.equal(leads[0].instrutorSlug, 'elidiano');
  assert.equal(leads[0].vendeu, true);
  assert.equal(leads[0].curso, 'Curso A');
  assert.equal(leads[1].vendeu, false);
});

test('resumoEvento conta total, vendas e atendidos', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  const r = resumoEvento(leads);
  assert.equal(r.total, 3);
  assert.equal(r.vendas, 1);
  assert.equal(r.valorTotal, 697);
  assert.equal(r.atendidos, 2); // etapaId 2 e 2 (não são a menor = 1)
});

test('resumoInstrutores agrupa e ordena por valor', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  const ins = resumoInstrutores(leads);
  assert.equal(ins[0].instrutor, 'Elidiano');
  assert.equal(ins[0].vendas, 1);
  assert.equal(ins.length, 2);
});
