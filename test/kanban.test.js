import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarColunas } from '../server/domain/kanban.js';

const leads = [
  { nome: 'A', etapaId: '2', etapaName: 'Em contato' },
  { nome: 'B', etapaId: '1', etapaName: 'Novo' },
  { nome: 'C', etapaId: '2', etapaName: 'Em contato' },
  { nome: 'D', etapaId: '3', etapaName: 'Convertido' },
];

test('agrupa leads por etapa e ordena por etapaId', () => {
  const cols = montarColunas(leads);
  assert.deepEqual(cols.map(c => c.etapaName), ['Novo', 'Em contato', 'Convertido']);
  assert.equal(cols[1].leads.length, 2);
});

test('lista vazia gera zero colunas', () => {
  assert.deepEqual(montarColunas([]), []);
});
