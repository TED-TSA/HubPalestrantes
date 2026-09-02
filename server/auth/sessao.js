import { randomBytes } from 'node:crypto';
import { montarCookie } from './cookie.js';

export const COOKIE_SESSAO = 'hub_sessao';
export const DURACAO_MS = 12 * 60 * 60 * 1000;
export const DURACAO_LONGA_MS = 30 * 24 * 60 * 60 * 1000;

export async function criarSessao(db, usuarioId, agora = Date.now(), duracao = DURACAO_MS) {
  const id = randomBytes(32).toString('base64url');
  await db.execute({
    sql: 'INSERT INTO sessoes (id, usuario_id, expira_em, duracao_ms) VALUES (?, ?, ?, ?)',
    args: [id, usuarioId, new Date(agora + duracao).toISOString(), duracao],
  });
  return id;
}

// Devolve o usuário da sessão (já com os vínculos) ou null. Renova pela mesma
// duração escolhida no login, para que quem marcou "manter conectado" não caia
// de volta para 12h na primeira requisição.
export async function lerSessao(db, id, agora = Date.now()) {
  if (!id) return null;
  const { rows: sessoes } = await db.execute({ sql: 'SELECT * FROM sessoes WHERE id = ?', args: [id] });
  const sessao = sessoes[0];
  if (!sessao) return null;
  if (Date.parse(sessao.expira_em) <= agora) {
    await destruirSessao(db, id);
    return null;
  }
  const { rows: usuarios } = await db.execute({
    sql: 'SELECT * FROM usuarios WHERE id = ? AND ativo = 1',
    args: [sessao.usuario_id],
  });
  const usuario = usuarios[0];
  if (!usuario) return null;
  const duracao = Number(sessao.duracao_ms) || DURACAO_MS;
  await db.execute({
    sql: 'UPDATE sessoes SET expira_em = ? WHERE id = ?',
    args: [new Date(agora + duracao).toISOString(), id],
  });
  const { rows: vinculos } = await db.execute({
    sql: 'SELECT nome_conexao FROM vinculos WHERE usuario_id = ?',
    args: [usuario.id],
  });
  return { ...usuario, vinculos: vinculos.map((v) => v.nome_conexao) };
}

export async function destruirSessao(db, id) {
  if (id) await db.execute({ sql: 'DELETE FROM sessoes WHERE id = ?', args: [id] });
}

export async function destruirSessoesDoUsuario(db, usuarioId) {
  await db.execute({ sql: 'DELETE FROM sessoes WHERE usuario_id = ?', args: [usuarioId] });
}

// Sem "manter conectado" o cookie não leva Max-Age: morre quando o navegador
// fecha, mesmo que a sessão no banco ainda valha.
export function cookieDeSessao(id, seguro, manterConectado = false) {
  return montarCookie(COOKIE_SESSAO, id, {
    maxAge: manterConectado ? Math.floor(DURACAO_LONGA_MS / 1000) : undefined,
    seguro,
  });
}

export function cookieDeSaida(seguro) {
  return montarCookie(COOKIE_SESSAO, '', { maxAge: 0, seguro });
}
