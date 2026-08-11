import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConexao } from '../server/domain/instrutor.js';

test('separa modalidade e instrutor', () => {
  assert.deepEqual(parseConexao('Presencial Elidiano'),
    { modalidade: 'Presencial', instrutor: 'Elidiano' });
});

test('instrutor com nome composto', () => {
  assert.deepEqual(parseConexao('Online Ana Paula'),
    { modalidade: 'Online', instrutor: 'Ana Paula' });
});

test('vazio vira Não identificado', () => {
  assert.deepEqual(parseConexao(''),
    { modalidade: '', instrutor: 'Não identificado' });
  assert.deepEqual(parseConexao(null),
    { modalidade: '', instrutor: 'Não identificado' });
});

test('sem espaço, tudo é instrutor', () => {
  assert.deepEqual(parseConexao('Fulano'),
    { modalidade: '', instrutor: 'Fulano' });
});
