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

-- Espelho do BigQuery. Consultar lá custa ~11s por chamada só para subir o CLI,
-- então a tela lê daqui e uma sincronização em segundo plano é quem paga essa
-- conta. De quebra, o dado sobrevive a reinício do servidor.
CREATE TABLE IF NOT EXISTS palestras (
  slug TEXT PRIMARY KEY,
  cidade TEXT NOT NULL,
  data TEXT NOT NULL,
  palestrantes TEXT NOT NULL,
  cadastrados INTEGER NOT NULL DEFAULT 0,
  presentes INTEGER NOT NULL DEFAULT 0,
  presentes_tribo INTEGER NOT NULL DEFAULT 0,
  presentes_aldeia INTEGER NOT NULL DEFAULT 0,
  presentes_lead INTEGER NOT NULL DEFAULT 0,
  pct_presenca REAL NOT NULL DEFAULT 0,
  vendas INTEGER NOT NULL DEFAULT 0,
  vendas_totais INTEGER NOT NULL DEFAULT 0,
  vendas_a_pagar INTEGER NOT NULL DEFAULT 0,
  canceladas INTEGER NOT NULL DEFAULT 0,
  conversao REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  palestra_slug TEXT NOT NULL REFERENCES palestras(slug) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  etapa TEXT NOT NULL,
  instrutor TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_palestra ON leads(palestra_slug);

CREATE TABLE IF NOT EXISTS sincronizacao (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  em TEXT NOT NULL,
  descartados INTEGER NOT NULL DEFAULT 0,
  sem_palestra INTEGER NOT NULL DEFAULT 0
);
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
