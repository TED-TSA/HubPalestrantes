import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexarVendas, cruzarLead } from '../server/domain/vendas.js';

const vendas = [
  { person_phone: '5549998033100', person_email: 'a@x.com', curso_comprado: 'Curso A', valor_pago: 697, data_venda: '2026-08-01', Equipe: 'Bruno' },
  { person_phone: '', person_email: 'b@x.com', curso_comprado: 'Curso B', valor_pago: 1200, data_venda: '2026-07-01', Equipe: 'Ana' },
];

test('casa lead por telefone', () => {
  const idx = indexarVendas(vendas);
  const v = cruzarLead({ Telefone: '(49) 99803-3100', Email: 'zzz@x.com' }, idx);
  assert.equal(v?.curso_comprado, 'Curso A');
});

test('casa por e-mail quando telefone não bate', () => {
  const idx = indexarVendas(vendas);
  const v = cruzarLead({ Telefone: '', Email: 'B@X.com' }, idx);
  assert.equal(v?.curso_comprado, 'Curso B');
});

test('sem correspondência retorna null', () => {
  const idx = indexarVendas(vendas);
  assert.equal(cruzarLead({ Telefone: '11111111111', Email: 'no@x.com' }, idx), null);
});
