import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarHash, conferirSenha, senhaAceitavel } from '../server/auth/senha.js';
import { lerCookies, montarCookie } from '../server/auth/cookie.js';
import { criarSessao, lerSessao, destruirSessao, DURACAO_MS } from '../server/auth/sessao.js';
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

function bancoComUsuario() {
  const db = abrirBanco(':memory:');
  const u = usuarios.criar(db, {
    email: 'elidiano@tradestars.com.br', nome: 'Elidiano',
    senha: 'senha-de-teste', vinculos: ['Elidiano', 'Elidiano Silva'],
  });
  return { db, u };
}

test('sessão válida devolve o usuário com os vínculos', () => {
  const { db, u } = bancoComUsuario();
  const id = criarSessao(db, u.id);
  const lido = lerSessao(db, id);
  assert.equal(lido.email, 'elidiano@tradestars.com.br');
  assert.deepEqual(lido.vinculos.sort(), ['Elidiano', 'Elidiano Silva']);
});

test('sessão expirada é rejeitada', () => {
  const { db, u } = bancoComUsuario();
  const id = criarSessao(db, u.id, Date.now() - DURACAO_MS * 2);
  assert.equal(lerSessao(db, id), null);
});

test('sessão destruída e token inventado são rejeitados', () => {
  const { db, u } = bancoComUsuario();
  const id = criarSessao(db, u.id);
  destruirSessao(db, id);
  assert.equal(lerSessao(db, id), null);
  assert.equal(lerSessao(db, 'token-inventado'), null);
  assert.equal(lerSessao(db, null), null);
});

test('desativar o usuário derruba a sessão aberta', () => {
  const { db, u } = bancoComUsuario();
  const id = criarSessao(db, u.id);
  usuarios.atualizar(db, u.id, { ativo: false });
  assert.equal(lerSessao(db, id), null);
});

test('um nome de Conexao não pode ter dois donos', () => {
  const { db } = bancoComUsuario();
  assert.throws(() => usuarios.criar(db, {
    email: 'outro@tradestars.com.br', nome: 'Outro',
    senha: 'senha-de-teste', vinculos: ['Elidiano'],
  }));
});

test('paraCliente nunca devolve o hash da senha', () => {
  const { db, u } = bancoComUsuario();
  const publico = usuarios.paraCliente(usuarios.porId(db, u.id));
  assert.equal(publico.senha_hash, undefined);
  assert.ok(!JSON.stringify(publico).includes('scrypt'));
});

test('email fora do domínio é recusado no cadastro', () => {
  const db = abrirBanco(':memory:');
  assert.throws(() => usuarios.criar(db, {
    email: 'alguem@gmail.com', nome: 'Alguém', senha: 'senha-de-teste',
  }));
});
