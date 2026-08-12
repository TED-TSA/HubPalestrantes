import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../server/app.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, vendasExemplo } from '../server/data/exemplo.js';
import { abrirBanco } from '../server/data/db.js';
import * as usuarios from '../server/data/usuarios.js';
import { zerarTudo } from '../server/auth/limite.js';

const SENHA = 'senha-de-teste';

async function subir() {
  limparCache();
  zerarTudo();
  const db = abrirBanco(':memory:');
  usuarios.criar(db, { email: 'admin@tradestars.com.br', nome: 'Admin', senha: SENHA, papel: 'admin' });
  usuarios.criar(db, { email: 'elidiano@tradestars.com.br', nome: 'Elidiano', senha: SENHA, vinculos: ['Elidiano'] });
  usuarios.criar(db, { email: 'diego@tradestars.com.br', nome: 'Diego', senha: SENHA, vinculos: ['Diego'] });
  const deps = { db, runQuery: async (sql) => (sql.includes('info_leads') ? leadsExemplo : vendasExemplo) };
  const srv = await new Promise((resolve) => {
    const s = criarApp(deps).listen(0, () => resolve(s));
  });
  return { srv, db, base: `http://localhost:${srv.address().port}` };
}

async function entrar(base, email, senha = SENHA) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const bruto = res.headers.get('set-cookie');
  return { res, cookie: bruto ? bruto.split(';')[0] : null };
}

const comCookie = (cookie) => ({ headers: { cookie } });

test('sem sessão, /api/eventos responde 401', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos`);
  assert.equal(res.status, 401);
  srv.close();
});

test('admin enxerga todos os eventos', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');
  const body = await (await fetch(`${base}/api/eventos`, comCookie(cookie))).json();
  assert.equal(body.length, 2);
  srv.close();
});

test('instrutor enxerga só os eventos e leads dele', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'elidiano@tradestars.com.br');

  const eventos = await (await fetch(`${base}/api/eventos`, comCookie(cookie))).json();
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, 'CXJ 3006');
  assert.equal(eventos[0].total, 4, 'só os 4 leads do Elidiano, não os 7 do evento');

  const detalhe = await (await fetch(`${base}/api/eventos/cxj-3006`, comCookie(cookie))).json();
  assert.deepEqual(detalhe.instrutores.map((i) => i.instrutor), ['Elidiano']);
  srv.close();
});

// O teste que importa: nada de outro instrutor pode trafegar no payload.
test('instrutor não alcança o evento nem os leads de outro', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'diego@tradestars.com.br');

  const detalhe = await fetch(`${base}/api/eventos/cxj-3006`, comCookie(cookie));
  assert.equal(detalhe.status, 404, 'o evento do colega não existe para ele');

  const eventos = await fetch(`${base}/api/eventos`, comCookie(cookie));
  const texto = JSON.stringify(await eventos.json());
  for (const alheio of ['Elidiano', 'Marina', 'Helena', 'Hérika', 'CXJ 3006']) {
    assert.ok(!texto.includes(alheio), `vazou "${alheio}" no payload do Diego`);
  }
  srv.close();
});

test('senha errada responde 401 com mensagem genérica', async () => {
  const { srv, base } = await subir();
  const { res } = await entrar(base, 'elidiano@tradestars.com.br', 'errada');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).erro, 'Email ou senha inválidos');
  srv.close();
});

test('email inexistente devolve exatamente o mesmo erro que senha errada', async () => {
  const { srv, base } = await subir();
  const inexistente = await entrar(base, 'ninguem@tradestars.com.br');
  const errada = await entrar(base, 'elidiano@tradestars.com.br', 'errada');
  assert.equal(inexistente.res.status, errada.res.status);
  assert.deepEqual(await inexistente.res.json(), await errada.res.json());
  srv.close();
});

test('logout invalida a sessão', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');
  await fetch(`${base}/api/logout`, { method: 'POST', ...comCookie(cookie) });
  const res = await fetch(`${base}/api/eventos`, comCookie(cookie));
  assert.equal(res.status, 401);
  srv.close();
});

test('instrutor não entra nas rotas de admin', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'elidiano@tradestars.com.br');
  const res = await fetch(`${base}/api/admin/usuarios`, comCookie(cookie));
  assert.equal(res.status, 403);
  srv.close();
});

test('admin cadastra instrutor e vê os nomes órfãos', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');

  const criado = await fetch(`${base}/api/admin/usuarios`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'marina@tradestars.com.br', nome: 'Marina',
      senha: 'outra-senha', vinculos: ['Marina'],
    }),
  });
  assert.equal(criado.status, 201);

  const nomes = await (await fetch(`${base}/api/admin/nomes`, comCookie(cookie))).json();
  const porNome = Object.fromEntries(nomes.map((n) => [n.nome, n.dono?.nome ?? null]));
  assert.equal(porNome.Marina, 'Marina');
  assert.equal(porNome.Helena, null, 'Helena aparece nos dados e ainda não tem dono');
  srv.close();
});

test('cadastro recusa email fora do domínio', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');
  const res = await fetch(`${base}/api/admin/usuarios`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'alguem@gmail.com', nome: 'Alguém', senha: 'senha-longa' }),
  });
  assert.equal(res.status, 400);
  srv.close();
});

test('a raiz redireciona para o login sem sessão', async () => {
  const { srv, base } = await subir();
  const res = await fetch(base, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  srv.close();
});
