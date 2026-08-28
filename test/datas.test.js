import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataCurta, rotuloPeriodo } from '../frontend/datas.js';

// Montado na mão de propósito: `new Date('2026-08-10')` é lido como UTC e
// mostraria 9 de agosto no fuso do Brasil.
test('a data do evento traz o ano', () => {
  assert.equal(dataCurta('2026-08-10'), '10 ago 2026');
});

test('dia com zero à frente perde o zero', () => {
  assert.equal(dataCurta('2026-01-01'), '1 jan 2026');
});

test('data ausente ou torta não vira texto quebrado', () => {
  assert.equal(dataCurta(''), '');
  assert.equal(dataCurta(null), '');
  assert.equal(dataCurta('10/08/2026'), '');
});

test('o período do filtro aparece como mês e ano', () => {
  assert.equal(rotuloPeriodo('2026-08'), 'ago 2026');
});
