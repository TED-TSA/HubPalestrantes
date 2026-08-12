import { gerarHash } from '../auth/senha.js';
import { destruirSessoesDoUsuario } from '../auth/sessao.js';
import { slug } from '../domain/texto.js';
import { config } from '../../config.js';

export function normalizarEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function emailDoDominio(email) {
  return normalizarEmail(email).endsWith(`@${config.dominioPermitido}`);
}

function comVinculos(db, usuario) {
  if (!usuario) return null;
  const vinculos = db.prepare('SELECT nome_conexao FROM vinculos WHERE usuario_id = ? ORDER BY nome_conexao')
    .all(usuario.id).map((v) => v.nome_conexao);
  return { ...usuario, vinculos };
}

export function porEmail(db, email) {
  return comVinculos(db, db.prepare('SELECT * FROM usuarios WHERE email = ?').get(normalizarEmail(email)));
}

export function porId(db, id) {
  return comVinculos(db, db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id));
}

export function listar(db) {
  return db.prepare('SELECT * FROM usuarios ORDER BY papel, nome').all().map((u) => comVinculos(db, u));
}

export function criar(db, { email, nome, senha, papel = 'instrutor', vinculos = [] }) {
  const e = normalizarEmail(email);
  if (!emailDoDominio(e)) throw new Error(`O email precisa ser @${config.dominioPermitido}`);
  if (!String(nome ?? '').trim()) throw new Error('Informe o nome');
  const info = db.prepare(`
    INSERT INTO usuarios (email, nome, senha_hash, papel, ativo, precisa_trocar_senha, criado_em)
    VALUES (?, ?, ?, ?, 1, 1, ?)
  `).run(e, String(nome).trim(), gerarHash(senha), papel, new Date().toISOString());
  const id = Number(info.lastInsertRowid);
  definirVinculos(db, id, vinculos);
  return porId(db, id);
}

export function atualizar(db, id, { nome, papel, ativo, vinculos }) {
  const atual = porId(db, id);
  if (!atual) throw new Error('Usuário não encontrado');
  db.prepare('UPDATE usuarios SET nome = ?, papel = ?, ativo = ? WHERE id = ?').run(
    nome === undefined ? atual.nome : String(nome).trim(),
    papel === undefined ? atual.papel : papel,
    ativo === undefined ? atual.ativo : (ativo ? 1 : 0),
    id,
  );
  if (vinculos !== undefined) definirVinculos(db, id, vinculos);
  // Desativar alguém precisa derrubar a sessão aberta dele, senão o acesso
  // continua valendo até o cookie expirar.
  if (ativo === false || ativo === 0) destruirSessoesDoUsuario(db, id);
  return porId(db, id);
}

export function trocarSenha(db, id, senha, { manterSessoes = false } = {}) {
  db.prepare('UPDATE usuarios SET senha_hash = ?, precisa_trocar_senha = 0 WHERE id = ?')
    .run(gerarHash(senha), id);
  if (!manterSessoes) destruirSessoesDoUsuario(db, id);
}

export function resetarSenha(db, id, senha) {
  db.prepare('UPDATE usuarios SET senha_hash = ?, precisa_trocar_senha = 1 WHERE id = ?')
    .run(gerarHash(senha), id);
  destruirSessoesDoUsuario(db, id);
}

export function definirVinculos(db, usuarioId, nomes) {
  const limpos = [...new Set((nomes ?? []).map((n) => String(n).trim()).filter(Boolean))];
  db.prepare('DELETE FROM vinculos WHERE usuario_id = ?').run(usuarioId);
  const ins = db.prepare('INSERT INTO vinculos (usuario_id, nome_conexao) VALUES (?, ?)');
  for (const nome of limpos) {
    try { ins.run(usuarioId, nome); }
    catch { throw new Error(`O nome "${nome}" já pertence a outro instrutor`); }
  }
}

export function donoDoNome(db, nomeConexao) {
  return db.prepare(`
    SELECT u.* FROM vinculos v JOIN usuarios u ON u.id = v.usuario_id WHERE v.nome_conexao = ?
  `).get(nomeConexao) ?? null;
}

// Visão pública do usuário: nunca devolve senha_hash para o frontend.
export function paraCliente(u) {
  if (!u) return null;
  const vinculos = u.vinculos ?? [];
  return {
    id: u.id,
    email: u.email,
    nome: u.nome,
    papel: u.papel,
    ativo: !!u.ativo,
    precisaTrocarSenha: !!u.precisa_trocar_senha,
    vinculos,
    // A foto é resolvida pelo nome do instrutor nos dados, não pelo nome do
    // cadastro — é assim que o arquivo em public/instrutores é nomeado.
    fotoSlug: slug(vinculos[0] ?? u.nome),
  };
}
