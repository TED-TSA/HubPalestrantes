import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarEventos, opcoesDeFiltro, SEM_FILTRO } from '../frontend/filtros.js';

const eventos = [
  {
    slug: 'sorocaba-2026-08-10', cidade: 'Sorocaba', data: '2026-08-10',
    instrutores: [{ instrutor: 'Elizier', slug: 'elizier' }],
  },
  {
    slug: 'ribeirao-preto-2026-07-29', cidade: 'Ribeirão Preto', data: '2026-07-29',
    instrutores: [{ instrutor: 'Elidiano', slug: 'elidiano' }, { instrutor: 'Elizier', slug: 'elizier' }],
  },
  {
    slug: 'uberlandia-2026-07-27', cidade: 'Uberlândia', data: '2026-07-27',
    instrutores: [{ instrutor: 'Elidiano', slug: 'elidiano' }],
  },
  {
    slug: 'sorocaba-2025-11-04', cidade: 'Sorocaba', data: '2025-11-04',
    instrutores: [{ instrutor: 'Marina', slug: 'marina' }],
  },
];

const slugs = (lista) => lista.map((e) => e.slug);

test('sem filtro nenhum, passam todos os eventos', () => {
  assert.deepEqual(slugs(filtrarEventos(eventos, SEM_FILTRO)), slugs(eventos));
});

test('filtra pelo mês escolhido', () => {
  assert.deepEqual(slugs(filtrarEventos(eventos, { ...SEM_FILTRO, periodo: '2026-07' })),
    ['ribeirao-preto-2026-07-29', 'uberlandia-2026-07-27']);
});

test('filtra pelo ano inteiro', () => {
  assert.deepEqual(slugs(filtrarEventos(eventos, { ...SEM_FILTRO, periodo: '2025' })),
    ['sorocaba-2025-11-04']);
});

test('filtra pela cidade, e a mesma cidade em datas diferentes vem junto', () => {
  assert.deepEqual(slugs(filtrarEventos(eventos, { ...SEM_FILTRO, cidade: 'Sorocaba' })),
    ['sorocaba-2026-08-10', 'sorocaba-2025-11-04']);
});

test('filtra pelo palestrante, inclusive quando ele dividiu o palco', () => {
  assert.deepEqual(slugs(filtrarEventos(eventos, { ...SEM_FILTRO, palestrante: 'elizier' })),
    ['sorocaba-2026-08-10', 'ribeirao-preto-2026-07-29']);
});

test('filtros combinados se somam', () => {
  const r = filtrarEventos(eventos, { periodo: '2026-07', cidade: 'Ribeirão Preto', palestrante: 'elizier' });
  assert.deepEqual(slugs(r), ['ribeirao-preto-2026-07-29']);
});

test('combinação sem resposta devolve lista vazia, não tudo', () => {
  assert.deepEqual(filtrarEventos(eventos, { ...SEM_FILTRO, cidade: 'Sorocaba', palestrante: 'elidiano' }), []);
});

// As opções saem dos eventos que a pessoa tem na mão: um instrutor nunca vê no
// filtro uma cidade em que não subiu ao palco, nem um mês sem palestra dele.
test('os períodos oferecidos são os que têm palestra, do mais recente ao mais antigo', () => {
  assert.deepEqual(opcoesDeFiltro(eventos).periodos, [
    { valor: '2026-08', rotulo: 'ago 2026' },
    { valor: '2026-07', rotulo: 'jul 2026' },
    { valor: '2025-11', rotulo: 'nov 2025' },
  ]);
});

test('cidade e palestrante vêm sem repetição e em ordem alfabética', () => {
  const o = opcoesDeFiltro(eventos);
  assert.deepEqual(o.cidades, ['Ribeirão Preto', 'Sorocaba', 'Uberlândia']);
  assert.deepEqual(o.palestrantes, [
    { valor: 'elidiano', rotulo: 'Elidiano' },
    { valor: 'elizier', rotulo: 'Elizier' },
    { valor: 'marina', rotulo: 'Marina' },
  ]);
});

test('lista vazia não quebra as opções', () => {
  assert.deepEqual(opcoesDeFiltro([]), { periodos: [], cidades: [], palestrantes: [] });
});
