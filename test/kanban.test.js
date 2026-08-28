import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarColunas } from '../server/domain/kanban.js';
import { config } from '../config.js';

// EtapaId real é um hash por funil; a ordem tem que vir de outro lugar.
const leads = [
  { nome: 'A', etapaId: 'z1v2IkJziFTgaUX8XF4Z', etapaName: 'SEM INTERESSE' },
  { nome: 'B', etapaId: 'W53MqnsBs6a8Rp7gqOGv', etapaName: 'EM CONTATO' },
  { nome: 'C', etapaId: 'W53MqnsBs6a8Rp7gqOGv', etapaName: 'EM CONTATO' },
  { nome: 'D', etapaId: 'U5v2etfZbC5SfOFlzE8U', etapaName: 'JÁ É ALDEIA' },
];

const nomes = (cols) => cols.map((c) => c.etapaName);
const acharColuna = (cols, nome) => cols.find((c) => c.etapaName === nome);

test('o quadro mostra o funil inteiro, na ordem configurada', () => {
  assert.deepEqual(nomes(montarColunas(leads)), config.ordemEtapas);
});

test('etapa sem nenhum lead continua no quadro, vazia', () => {
  const cols = montarColunas(leads);
  assert.deepEqual(acharColuna(cols, 'MENTORIA').leads, []);
});

test('sem lead nenhum o quadro ainda é o funil inteiro', () => {
  assert.deepEqual(nomes(montarColunas([])), config.ordemEtapas);
});

test('agrupa os leads na coluna da etapa', () => {
  const cols = montarColunas(leads);
  assert.deepEqual(acharColuna(cols, 'EM CONTATO').leads.map((l) => l.nome), ['B', 'C']);
});

// A origem grava a mesma etapa com e sem acento. Sem normalizar, o quadro
// mostrava "JÁ É MEMBRO" e "JA É MEMBRO" como duas colunas diferentes.
test('a mesma etapa escrita sem acento cai na mesma coluna', () => {
  const cols = montarColunas([
    { nome: 'E', etapaId: 'x', etapaName: 'JÁ É MEMBRO' },
    { nome: 'F', etapaId: 'x', etapaName: 'JA É MEMBRO' },
    { nome: 'G', etapaId: 'x', etapaName: 'já é membro' },
  ]);
  assert.equal(nomes(cols).filter((n) => n.includes('MEMBRO')).length, 1);
  assert.deepEqual(acharColuna(cols, 'JÁ É MEMBRO').leads.map((l) => l.nome), ['E', 'F', 'G']);
});

test('etapa que a configuração não conhece entra no fim, sem sumir', () => {
  const cols = montarColunas([...leads, { nome: 'H', etapaId: 'x', etapaName: 'ETAPA NOVA' }]);
  assert.equal(cols.at(-1).etapaName, 'ETAPA NOVA');
  assert.deepEqual(cols.at(-1).leads.map((l) => l.nome), ['H']);
});

test('etapas desconhecidas se enfileiram em ordem alfabética', () => {
  const cols = montarColunas([
    { nome: 'I', etapaId: 'x', etapaName: 'ZONA' },
    { nome: 'J', etapaId: 'x', etapaName: 'ALFA' },
  ]);
  assert.deepEqual(nomes(cols).slice(-2), ['ALFA', 'ZONA']);
});
