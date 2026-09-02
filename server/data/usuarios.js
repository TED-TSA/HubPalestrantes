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

async function comVinculos(db, usuario) {
  if (!usuario) return null;
  const { rows } = await db.execute({
    sql: 'SELECT nome_conexao FROM vinculos WHERE usuario_id = ? ORDER BY nome_conexao',
    args: [usuario.id],
  });
  return { ...usuario, vinculos: rows.map((v) => v.nome_conexao) };
}

export async function porEmail(db, email) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM usuarios WHERE email = ?', args: [normalizarEmail(email)] });
  return comVinculos(db, rows[0] ?? null);
}

export async function porId(db, id) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [id] });
  return comVinculos(db, rows[0] ?? null);
}

export async function listar(db) {
  const { rows } = await db.execute('SELECT * FROM usuarios ORDER BY papel, nome');
  return Promise.all(rows.map((u) => comVinculos(db, u)));
}

export async function criar(db, { email, nome, senha, papel = 'instrutor', vinculos = [] }) {
  const e = normalizarEmail(email);
  if (!emailDoDominio(e)) throw new Error(`O email precisa ser @${config.dominioPermitido}`);
  if (!String(nome ?? '').trim()) throw new Error('Informe o nome');
  const info = await db.execute({
    sql: `INSERT INTO usuarios (email, nome, senha_hash, papel, ativo, precisa_trocar_senha, criado_em)
    VALUES (?, ?, ?, ?, 1, 1, ?)`,
    args: [e, String(nome).trim(), gerarHash(senha), papel, new Date().toISOString()],
  });
  const id = Number(info.lastInsertRowid);
  await definirVinculos(db, id, vinculos);
  return porId(db, id);
}

export async function atualizar(db, id, { nome, papel, ativo, vinculos }) {
  const atual = await porId(db, id);
  if (!atual) throw new Error('Usuário não encontrado');
  await db.execute({
    sql: 'UPDATE usuarios SET nome = ?, papel = ?, ativo = ? WHERE id = ?',
    args: [
      nome === undefined ? atual.nome : String(nome).trim(),
      papel === undefined ? atual.papel : papel,
      ativo === undefined ? atual.ativo : (ativo ? 1 : 0),
      id,
    ],
  });
  if (vinculos !== undefined) await definirVinculos(db, id, vinculos);
  // Desativar alguém precisa derrubar a sessão aberta dele, senão o acesso
  // continua valendo até o cookie expirar.
  if (ativo === false || ativo === 0) await destruirSessoesDoUsuario(db, id);
  return porId(db, id);
}

export async function trocarSenha(db, id, senha, { manterSessoes = false } = {}) {
  await db.execute({
    sql: 'UPDATE usuarios SET senha_hash = ?, precisa_trocar_senha = 0 WHERE id = ?',
    args: [gerarHash(senha), id],
  });
  if (!manterSessoes) await destruirSessoesDoUsuario(db, id);
}

export async function resetarSenha(db, id, senha) {
  await db.execute({
    sql: 'UPDATE usuarios SET senha_hash = ?, precisa_trocar_senha = 1 WHERE id = ?',
    args: [gerarHash(senha), id],
  });
  await destruirSessoesDoUsuario(db, id);
}

export async function definirVinculos(db, usuarioId, nomes) {
  const limpos = [...new Set((nomes ?? []).map((n) => String(n).trim()).filter(Boolean))];
  await db.execute({ sql: 'DELETE FROM vinculos WHERE usuario_id = ?', args: [usuarioId] });
  for (const nome of limpos) {
    try {
      await db.execute({ sql: 'INSERT INTO vinculos (usuario_id, nome_conexao) VALUES (?, ?)', args: [usuarioId, nome] });
    } catch {
      throw new Error(`O nome "${nome}" já pertence a outro instrutor`);
    }
  }
}

export async function donoDoNome(db, nomeConexao) {
  const { rows } = await db.execute({
    sql: 'SELECT u.* FROM vinculos v JOIN usuarios u ON u.id = v.usuario_id WHERE v.nome_conexao = ?',
    args: [nomeConexao],
  });
  return rows[0] ?? null;
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
