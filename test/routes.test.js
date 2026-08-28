import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../server/app.js';
import { sincronizar } from '../server/data/sincronizacao.js';
import { leadsExemplo, palestrasExemplo } from '../server/data/exemplo.js';
import { abrirBanco } from '../server/data/db.js';
import * as usuarios from '../server/data/usuarios.js';
import { zerarTudo } from '../server/auth/limite.js';

const SENHA = 'senha-de-teste';

async function subir() {
  zerarTudo();
  const db = abrirBanco(':memory:');
  usuarios.criar(db, { email: 'admin@tradestars.com.br', nome: 'Admin', senha: SENHA, papel: 'admin' });
  // Elizier subiu em Sorocaba; Elidiano em Ribeirão Preto e Uberlândia.
  usuarios.criar(db, { email: 'elizier@tradestars.com.br', nome: 'Elizier', senha: SENHA, vinculos: ['Elizier'] });
  usuarios.criar(db, { email: 'marcos@tradestars.com.br', nome: 'Marcos', senha: SENHA, vinculos: ['Marcos'] });

  await sincronizar(db, {
    runQuery: async (sql) => (sql.includes('presencial_metricas') ? palestrasExemplo : leadsExemplo),
  });
  const srv = await new Promise((resolve) => {
    const s = criarApp({ db }).listen(0, () => resolve(s));
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

test('admin enxerga todas as palestras', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');
  const body = await (await fetch(`${base}/api/eventos`, comCookie(cookie))).json();
  assert.equal(body.length, 3);
  assert.equal(body[0].cidade, 'Sorocaba');
  srv.close();
});

test('instrutor enxerga só as palestras em que subiu ao palco', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'elizier@tradestars.com.br');
  const eventos = await (await fetch(`${base}/api/eventos`, comCookie(cookie))).json();
  assert.deepEqual(eventos.map((e) => e.cidade), ['Sorocaba', 'Ribeirão Preto']);
  srv.close();
});

// O teste que importa: nada de palestra alheia pode trafegar no payload.
test('instrutor não alcança a palestra nem os leads de outro', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'marcos@tradestars.com.br');

  const detalhe = await fetch(`${base}/api/eventos/sorocaba-2026-08-10`, comCookie(cookie));
  assert.equal(detalhe.status, 404, 'a palestra do colega não existe para ele');

  const eventos = await fetch(`${base}/api/eventos`, comCookie(cookie));
  const texto = JSON.stringify(await eventos.json());
  for (const alheio of ['Elizier', 'Elidiano', 'Sorocaba', 'Hérika', 'Uberlândia']) {
    assert.ok(!texto.includes(alheio), `vazou "${alheio}" no payload do Marcos`);
  }
  srv.close();
});

test('senha errada responde 401 com mensagem genérica', async () => {
  const { srv, base } = await subir();
  const { res } = await entrar(base, 'elizier@tradestars.com.br', 'errada');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).erro, 'Email ou senha inválidos');
  srv.close();
});

test('email inexistente devolve exatamente o mesmo erro que senha errada', async () => {
  const { srv, base } = await subir();
  const inexistente = await entrar(base, 'ninguem@tradestars.com.br');
  const errada = await entrar(base, 'elizier@tradestars.com.br', 'errada');
  assert.equal(inexistente.res.status, errada.res.status);
  assert.deepEqual(await inexistente.res.json(), await errada.res.json());
  srv.close();
});

test('sem "manter conectado" o cookie morre com o navegador', async () => {
  const { srv, base } = await subir();
  const semManter = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tradestars.com.br', senha: SENHA }),
  });
  assert.ok(!/Max-Age/i.test(semManter.headers.get('set-cookie')));

  const comManter = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tradestars.com.br', senha: SENHA, manterConectado: true }),
  });
  assert.ok(/Max-Age=\d+/i.test(comManter.headers.get('set-cookie')));
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
  const { cookie } = await entrar(base, 'elizier@tradestars.com.br');
  assert.equal((await fetch(`${base}/api/admin/usuarios`, comCookie(cookie))).status, 403);
  assert.equal((await fetch(`${base}/api/admin/saude`, comCookie(cookie))).status, 403);
  assert.equal((await fetch(`${base}/api/admin/crm-pipelines`, comCookie(cookie))).status, 403);
  srv.close();
});

test('admin cadastra, lista e remove pipeline/coluna do CRM', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');

  const criado = await (await fetch(`${base}/api/admin/crm-pipelines`, {
    method: 'POST', ...comCookie(cookie),
    headers: { ...comCookie(cookie).headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      pipelineNome: 'Presencial Teste - [0101] TST', pipelineId: 'pid-teste',
      etapaNome: 'EM CONTATO', colunaId: 'col-teste',
    }),
  })).json();
  assert.ok(criado.id);

  const lista = await (await fetch(`${base}/api/admin/crm-pipelines`, comCookie(cookie))).json();
  assert.ok(lista.some((l) => l.id === criado.id));

  const repetido = await fetch(`${base}/api/admin/crm-pipelines`, {
    method: 'POST', ...comCookie(cookie),
    headers: { ...comCookie(cookie).headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      pipelineNome: 'Presencial Teste - [0101] TST', pipelineId: 'pid-teste',
      etapaNome: 'SEM INTERESSE', colunaId: 'col-teste',
    }),
  });
  assert.equal(repetido.status, 409, 'mesma coluna pro mesmo pipeline não pode duplicar');

  await fetch(`${base}/api/admin/crm-pipelines/${criado.id}`, { method: 'DELETE', ...comCookie(cookie) });
  const listaDepois = await (await fetch(`${base}/api/admin/crm-pipelines`, comCookie(cookie))).json();
  assert.ok(!listaDepois.some((l) => l.id === criado.id));
  srv.close();
});

test('admin vê os nomes órfãos e a saúde dos dados', async () => {
  const { srv, base } = await subir();
  const { cookie } = await entrar(base, 'admin@tradestars.com.br');

  const nomes = await (await fetch(`${base}/api/admin/nomes`, comCookie(cookie))).json();
  const porNome = Object.fromEntries(nomes.map((n) => [n.nome, n.dono?.nome ?? null]));
  assert.equal(porNome.Elizier, 'Elizier');
  assert.equal(porNome.Elidiano, null, 'Elidiano aparece nos dados e não tem dono');

  const s = await (await fetch(`${base}/api/admin/saude`, comCookie(cookie))).json();
  assert.equal(s.descartados, 2);
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
