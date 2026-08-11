import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soDigitos, chaveTelefone, normalizarEmail, slug } from '../server/domain/texto.js';

test('soDigitos remove tudo que não é dígito', () => {
  assert.equal(soDigitos('+55 (49) 99803-3100'), '5549998033100');
  assert.equal(soDigitos(null), '');
});

test('chaveTelefone pega os últimos 8 dígitos', () => {
  assert.equal(chaveTelefone('+55 49 99803-3100'), '98033100');
  assert.equal(chaveTelefone('351912280468'), '12280468');
  assert.equal(chaveTelefone('123'), '');
});

test('normalizarEmail faz trim e minúsculas', () => {
  assert.equal(normalizarEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(normalizarEmail(undefined), '');
});

test('slug remove acentos e normaliza', () => {
  assert.equal(slug('João Pedro'), 'joao-pedro');
  assert.equal(slug('CXJ 3006'), 'cxj-3006');
  assert.equal(slug('Elidiano'), 'elidiano');
});
