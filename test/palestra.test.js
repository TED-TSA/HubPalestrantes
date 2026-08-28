import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarPalestra, separarPalestrantes, cidadeDoPipeline,
  parseCodigoEvento, formatarCodigoEvento, indexarPalestrasPorSigla, resolverPorCodigoEvento,
} from '../server/domain/palestra.js';

const linha = {
  cidade: 'Ribeirão Preto', data_evento: '2026-07-29', palestrante: 'Elidiano / Elizier',
  cadastrados: 950, checkin_geral: 72, checkin_tribo: 9, checkin_aldeia: 5, checkin_lead: 58,
  pct_presentes: 7.6, vendas_total: 10, vendas_a_pagar: 2, cancelados: 2, vendas_efetivas: 8,
};

// A taxa que a gestão cobra é o que a palestra vendeu no palco. Cancelamento e
// pagamento pendente são história posterior, e descontá-los da conversão fazia
// o número da palestra piorar depois do evento ter acabado.
test('a conversão sai das vendas totais, não das efetivas', () => {
  const p = montarPalestra(linha);
  assert.equal(Math.round(p.conversao * 1000) / 10, 13.9);
});

test('palestra sem ninguém na sala não divide por zero', () => {
  const p = montarPalestra({ ...linha, checkin_geral: 0 });
  assert.equal(p.conversao, 0);
});

test('separa os palestrantes pela barra', () => {
  assert.deepEqual(separarPalestrantes('Elidiano / Elizier'), ['Elidiano', 'Elizier']);
});

test('montarPalestra traz a sigla da linha', () => {
  assert.equal(montarPalestra({ ...linha, sigla: 'RIB' }).sigla, 'RIB');
});

test('parseCodigoEvento lê "[ddmm]SIGLA", com ou sem colchete', () => {
  assert.deepEqual(parseCodigoEvento('[0406]MAN'), { dia: 4, mes: 6, sigla: 'MAN' });
  assert.deepEqual(parseCodigoEvento('2105BC'), { dia: 21, mes: 5, sigla: 'BC' });
});

test('parseCodigoEvento ignora o que vem depois da barra (instrutor, não evento)', () => {
  assert.deepEqual(parseCodigoEvento('[0108] SP/JAC'), { dia: 1, mes: 8, sigla: 'SP' });
});

test('parseCodigoEvento sem o formato esperado volta null', () => {
  assert.equal(parseCodigoEvento('Presencial Sorocaba'), null);
  assert.equal(parseCodigoEvento(null), null);
});

// Formato fixo do PipelineName a partir de 21/08/2026: o código não vem mais
// solto, vem depois do nome da cidade — parseCodigoEvento precisa achar mesmo
// com texto antes.
test('parseCodigoEvento lê o código embutido no PipelineName novo', () => {
  assert.deepEqual(
    parseCodigoEvento('Presencial Balneário Camboriú - [1008] BAL'),
    { dia: 10, mes: 8, sigla: 'BAL' },
  );
});

test('cidadeDoPipeline corta o código do PipelineName novo, sobra só a cidade', () => {
  assert.equal(cidadeDoPipeline('Presencial Balneário Camboriú - [1008] BAL'), 'Balneário Camboriú');
  // Formato antigo, sem código, continua igual.
  assert.equal(cidadeDoPipeline('Presencial Ribeirão Preto'), 'Ribeirão Preto');
});

// Visto na base real: Manaus está em 03/06 na base de métricas, e o primeiro
// lead com eventName preenchido trouxe "[0406]MAN" — dia 04. Com sigla única,
// a data não é motivo pra descartar o cruzamento.
test('sigla única resolve direto, mesmo com a data batendo torto', () => {
  const manaus = montarPalestra({ ...linha, cidade: 'Manaus', sigla: 'MAN', data_evento: '2026-06-03' });
  const porSigla = indexarPalestrasPorSigla([manaus]);
  const resolvida = resolverPorCodigoEvento({ dia: 4, mes: 6, sigla: 'MAN' }, porSigla);
  assert.equal(resolvida.slug, manaus.slug);
});

test('sigla repetida (Balneário Camboriú) desempata pela data mais perto', () => {
  const maio = montarPalestra({ ...linha, cidade: 'Balneário Camboriú', sigla: 'BC', data_evento: '2026-05-20' });
  const agosto = montarPalestra({ ...linha, cidade: 'Balneário Camboriú', sigla: 'BC', data_evento: '2026-08-10' });
  const porSigla = indexarPalestrasPorSigla([maio, agosto]);

  assert.equal(resolverPorCodigoEvento({ dia: 20, mes: 5, sigla: 'BC' }, porSigla).slug, maio.slug);
  assert.equal(resolverPorCodigoEvento({ dia: 10, mes: 8, sigla: 'BC' }, porSigla).slug, agosto.slug);
});

test('fora da tolerância de 5 dias, sigla repetida não resolve', () => {
  const maio = montarPalestra({ ...linha, cidade: 'Balneário Camboriú', sigla: 'BC', data_evento: '2026-05-20' });
  const agosto = montarPalestra({ ...linha, cidade: 'Balneário Camboriú', sigla: 'BC', data_evento: '2026-08-10' });
  const porSigla = indexarPalestrasPorSigla([maio, agosto]);
  // 1º de julho não está a 5 dias de nenhuma das duas datas.
  assert.equal(resolverPorCodigoEvento({ dia: 1, mes: 7, sigla: 'BC' }, porSigla), null);
});

test('sigla sem nenhuma palestra correspondente volta null', () => {
  const porSigla = indexarPalestrasPorSigla([montarPalestra({ ...linha, sigla: 'RIB' })]);
  assert.equal(resolverPorCodigoEvento({ dia: 1, mes: 1, sigla: 'XYZ' }, porSigla), null);
});

test('formatarCodigoEvento gera o formato canônico, não o cru da origem', () => {
  const p = montarPalestra({ ...linha, cidade: 'Balneário Camboriú', sigla: 'BC', data_evento: '2026-08-10' });
  assert.equal(formatarCodigoEvento(p), '[1008]BC');
});

test('formatarCodigoEvento e parseCodigoEvento são inversos', () => {
  const p = montarPalestra({ ...linha, cidade: 'Manaus', sigla: 'MAN', data_evento: '2026-06-03' });
  const codigo = parseCodigoEvento(formatarCodigoEvento(p));
  assert.deepEqual(codigo, { dia: 3, mes: 6, sigla: 'MAN' });
});
