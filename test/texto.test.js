import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../server/domain/texto.js';

test('slug remove acentos e normaliza', () => {
  assert.equal(slug('Ribeirão Preto'), 'ribeirao-preto');
  assert.equal(slug('Balneário Camboriú'), 'balneario-camboriu');
  assert.equal(slug('São José dos Campos'), 'sao-jose-dos-campos');
  assert.equal(slug('  Vitória  '), 'vitoria');
  assert.equal(slug(null), '');
});
