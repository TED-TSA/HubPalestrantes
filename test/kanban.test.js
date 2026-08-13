import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarColunas } from '../server/domain/kanban.js';

// EtapaId real é um hash por funil; a ordem tem que vir de outro lugar.
const leads = [
  { nome: 'A', etapaId: 'z1v2IkJziFTgaUX8XF4Z', etapaName: 'SEM INTERESSE' },
  { nome: 'B', etapaId: 'W53MqnsBs6a8Rp7gqOGv', etapaName: 'EM CONTATO' },
  { nome: 'C', etapaId: 'W53MqnsBs6a8Rp7gqOGv', etapaName: 'EM CONTATO' },
  { nome: 'D', etapaId: 'U5v2etfZbC5SfOFlzE8U', etapaName: 'JÁ É ALDEIA' },
];

test('agrupa por etapa e ordena pelo funil configurado', () => {
  const cols = montarColunas(leads);
  assert.deepEqual(cols.map((c) => c.etapaName), ['EM CONTATO', 'JÁ É ALDEIA', 'SEM INTERESSE']);
  assert.equal(cols[0].leads.length, 2);
});

test('etapa fora da configuração vai para o fim', () => {
  const cols = montarColunas([...leads, { nome: 'E', etapaId: 'x', etapaName: 'ETAPA NOVA' }]);
  assert.equal(cols.at(-1).etapaName, 'ETAPA NOVA');
});

test('lista vazia gera zero colunas', () => {
  assert.deepEqual(montarColunas([]), []);
});
