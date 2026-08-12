import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('instrutor', 'admin')),
  ativo INTEGER NOT NULL DEFAULT 1,
  precisa_trocar_senha INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vinculos (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome_conexao TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL,
  duracao_ms INTEGER NOT NULL DEFAULT 43200000
);

CREATE INDEX IF NOT EXISTS idx_vinculos_usuario ON vinculos(usuario_id);
`;

// Migração de bico: adiciona a coluna se o banco foi criado antes dela existir.
// Sem isto, um hub.db já em uso quebraria ao subir a versão nova.
function garantirColuna(db, tabela, coluna, definicao) {
  const existe = db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}

export function abrirBanco(caminho = ':memory:') {
  const db = new DatabaseSync(caminho);
  db.exec(SCHEMA);
  garantirColuna(db, 'sessoes', 'duracao_ms', 'INTEGER NOT NULL DEFAULT 43200000');
  return db;
}

let padrao = null;

export function bancoPadrao() {
  if (!padrao) {
    const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    padrao = abrirBanco(path.join(raiz, config.dbArquivo));
  }
  return padrao;
}
