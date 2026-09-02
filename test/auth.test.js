import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarHash, conferirSenha, senhaAceitavel } from '../server/auth/senha.js';
import { lerCookies, montarCookie } from '../server/auth/cookie.js';
import {
  criarSessao, lerSessao, destruirSessao, DURACAO_MS, DURACAO_LONGA_MS,
} from '../server/auth/sessao.js';
import { abrirBanco } from '../server/data/db.js';
import * as usuarios from '../server/data/usuarios.js';

test('hash valida a senha certa e recusa a errada', () => {
  const hash = gerarHash('cavalo-bateria-grampo');
  assert.ok(conferirSenha('cavalo-bateria-grampo', hash));
  assert.ok(!conferirSenha('cavalo-bateria-grampos', hash));
  assert.ok(!conferirSenha('', hash));
});

test('a mesma senha gera hashes diferentes (salt por usuário)', () => {
  assert.notEqual(gerarHash('mesma-senha'), gerarHash('mesma-senha'));
});

test('hash corrompido não derruba a verificação', () => {
  assert.ok(!conferirSenha('qualquer', 'lixo'));
  assert.ok(!conferirSenha('qualquer', ''));
  assert.ok(!conferirSenha('qualquer', null));
});

test('senha curta é recusada', () => {
  assert.ok(!senhaAceitavel('1234567'));
  assert.ok(senhaAceitavel('12345678'));
});

test('leitura do header Cookie', () => {
  assert.deepEqual(lerCookies('a=1; b=dois'), { a: '1', b: 'dois' });
  assert.deepEqual(lerCookies('hub_sessao=abc%20def'), { hub_sessao: 'abc def' });
  assert.deepEqual(lerCookies(''), {});
  assert.deepEqual(lerCookies(undefined), {});
  assert.deepEqual(lerCookies('quebrado'), {});
});

test('o cookie de sessão sai protegido', () => {
  const c = montarCookie('hub_sessao', 'xyz', { maxAge: 60 });
  assert.ok(c.includes('HttpOnly'));
  assert.ok(c.includes('SameSite=Lax'));
  assert.ok(!c.includes('Secure'));
  assert.ok(montarCookie('hub_sessao', 'xyz', { seguro: true }).includes('Secure'));
});

async function bancoComUsuario() {
  const db = await abrirBanco(':memory:');
  const u = await usuarios.criar(db, {
    email: 'elidiano@tradestars.com.br', nome: 'Elidiano',
    senha: 'senha-de-teste', vinculos: ['Elidiano', 'Elidiano Silva'],
  });
  return { db, u };
}

test('sessão válida devolve o usuário com os vínculos', async () => {
  const { db, u } = await bancoComUsuario();
  const id = await criarSessao(db, u.id);
  const lido = await lerSessao(db, id);
  assert.equal(lido.email, 'elidiano@tradestars.com.br');
  assert.deepEqual(lido.vinculos.sort(), ['Elidiano', 'Elidiano Silva']);
});

test('sessão expirada é rejeitada', async () => {
  const { db, u } = await bancoComUsuario();
  const id = await criarSessao(db, u.id, Date.now() - DURACAO_MS * 2);
  assert.equal(await lerSessao(db, id), null);
});

test('manter conectado sobrevive ao prazo da sessão curta', async () => {
  const { db, u } = await bancoComUsuario();
  const curta = await criarSessao(db, u.id);
  const longa = await criarSessao(db, u.id, Date.now(), DURACAO_LONGA_MS);
  const daquiTrezeHoras = Date.now() + 13 * 60 * 60 * 1000;
  assert.equal(await lerSessao(db, curta, daquiTrezeHoras), null);
  assert.ok(await lerSessao(db, longa, daquiTrezeHoras));
});

test('a renovação respeita a duração escolhida no login', async () => {
  const { db, u } = await bancoComUsuario();
  const longa = await criarSessao(db, u.id, Date.now(), DURACAO_LONGA_MS);
  // Uma requisição qualquer renova a sessão; ela não pode encolher para 12h.
  await lerSessao(db, longa);
  const linha = (await db.execute({ sql: 'SELECT expira_em FROM sessoes WHERE id = ?', args: [longa] })).rows[0];
  const validade = Date.parse(linha.expira_em);
  assert.ok(validade - Date.now() > DURACAO_MS, 'a sessão longa encolheu na renovação');
});

test('sessão destruída e token inventado são rejeitados', async () => {
  const { db, u } = await bancoComUsuario();
  const id = await criarSessao(db, u.id);
  await destruirSessao(db, id);
  assert.equal(await lerSessao(db, id), null);
  assert.equal(await lerSessao(db, 'token-inventado'), null);
  assert.equal(await lerSessao(db, null), null);
});

test('desativar o usuário derruba a sessão aberta', async () => {
  const { db, u } = await bancoComUsuario();
  const id = await criarSessao(db, u.id);
  await usuarios.atualizar(db, u.id, { ativo: false });
  assert.equal(await lerSessao(db, id), null);
});

test('um nome de Conexao não pode ter dois donos', async () => {
  const { db } = await bancoComUsuario();
  await assert.rejects(() => usuarios.criar(db, {
    email: 'outro@tradestars.com.br', nome: 'Outro',
    senha: 'senha-de-teste', vinculos: ['Elidiano'],
  }));
});

test('paraCliente nunca devolve o hash da senha', async () => {
  const { db, u } = await bancoComUsuario();
  const publico = usuarios.paraCliente(await usuarios.porId(db, u.id));
  assert.equal(publico.senha_hash, undefined);
  assert.ok(!JSON.stringify(publico).includes('scrypt'));
});

test('email fora do domínio é recusado no cadastro', async () => {
  const db = await abrirBanco(':memory:');
  await assert.rejects(() => usuarios.criar(db, {
    email: 'alguem@gmail.com', nome: 'Alguém', senha: 'senha-de-teste',
  }));
});
