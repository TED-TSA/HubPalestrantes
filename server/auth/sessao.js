import { randomBytes } from 'node:crypto';
import { montarCookie } from './cookie.js';

export const COOKIE_SESSAO = 'hub_sessao';
export const DURACAO_MS = 12 * 60 * 60 * 1000;

export function criarSessao(db, usuarioId, agora = Date.now()) {
  const id = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessoes (id, usuario_id, expira_em) VALUES (?, ?, ?)')
    .run(id, usuarioId, new Date(agora + DURACAO_MS).toISOString());
  return id;
}

// Devolve o usuário da sessão (já com os vínculos) ou null. Renova a validade a
// cada uso, para que quem está trabalhando não seja deslogado no meio.
export function lerSessao(db, id, agora = Date.now()) {
  if (!id) return null;
  const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(id);
  if (!sessao) return null;
  if (Date.parse(sessao.expira_em) <= agora) {
    destruirSessao(db, id);
    return null;
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(sessao.usuario_id);
  if (!usuario) return null;
  db.prepare('UPDATE sessoes SET expira_em = ? WHERE id = ?')
    .run(new Date(agora + DURACAO_MS).toISOString(), id);
  const vinculos = db.prepare('SELECT nome_conexao FROM vinculos WHERE usuario_id = ?')
    .all(usuario.id).map((v) => v.nome_conexao);
  return { ...usuario, vinculos };
}

export function destruirSessao(db, id) {
  if (id) db.prepare('DELETE FROM sessoes WHERE id = ?').run(id);
}

export function destruirSessoesDoUsuario(db, usuarioId) {
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuarioId);
}

export function cookieDeSessao(id, seguro) {
  return montarCookie(COOKIE_SESSAO, id, { maxAge: Math.floor(DURACAO_MS / 1000), seguro });
}

export function cookieDeSaida(seguro) {
  return montarCookie(COOKIE_SESSAO, '', { maxAge: 0, seguro });
}
