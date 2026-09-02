import { createClient } from '@libsql/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';
import { semear as semearCrmPipelines } from './crmPipelines.js';

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
  -- JSON de nomes (ex.: '["Elidiano","Elizier"]'), do campo Palestrante de
  -- info_leads. NULL quando a origem não traz isso pro evento — nesse caso o
  -- lead é creditado a quem subiu ao palco (server/data/repository.js).
  palestrantes TEXT,
  -- checkin_em: terreno preparado, não fonte de dado — vai vir da coluna
  -- DataCheckin em info_leads, combinada em 19/08/2026 e ainda não criada
  -- (docs/dados-que-faltam.md). Fica NULL até a sincronização ter de onde ler.
  -- closer: já é dado de verdade, vindo da coluna Atendente de info_leads.
  checkin_em TEXT,
  closer TEXT,
  -- Chave estável de identidade do lead (palestra+telefone+email+nome), usada
  -- pela sincronização para diferenciar "lead novo" de "lead que só mudou de
  -- etapa" (server/data/sincronizacao.js) — só ela permite atualizar em vez de
  -- apagar e reinserir tudo a cada ciclo, o que estouraria a cota de escrita
  -- do Turso (ver docs da migração, 31/08/2026). Sem UNIQUE de propósito: dois
  -- leads sem telefone/email e mesmo nome no mesmo evento colidiriam, e um
  -- erro de constraint no meio do batch é pior que o raro falso-empate.
  chave_diff TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_palestra ON leads(palestra_slug);
CREATE INDEX IF NOT EXISTS idx_leads_chave_diff ON leads(chave_diff);

CREATE TABLE IF NOT EXISTS sincronizacao (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  em TEXT NOT NULL,
  descartados INTEGER NOT NULL DEFAULT 0,
  sem_palestra INTEGER NOT NULL DEFAULT 0,
  duplicados INTEGER NOT NULL DEFAULT 0
);

-- Mapa pipeline/coluna do CRM do Unnichat, usado pela reconciliação direta na
-- API (server/data/reconciliarUnnichat.js). Existe porque a UnniAPI não tem
-- endpoint de listagem (confirmado com o suporte em 28/08/2026) — o único
-- jeito de saber esses IDs é cadastrando à mão, daqui pra frente pela tela de
-- admin em vez de arquivo estático.
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id INTEGER PRIMARY KEY,
  pipeline_nome TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  etapa_nome TEXT NOT NULL,
  coluna_id TEXT NOT NULL,
  UNIQUE(pipeline_id, coluna_id)
);
`;

async function colunas(db, tabela) {
  const { rows } = await db.execute(`PRAGMA table_info(${tabela})`);
  return rows.map((c) => c.name);
}

// Migração de bico: adiciona a coluna se o banco foi criado antes dela existir.
// Sem isto, um hub.db/Turso já em uso quebraria ao subir a versão nova.
async function garantirColuna(db, tabela, coluna, definicao) {
  if (!(await colunas(db, tabela)).includes(coluna)) {
    await db.execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

// O inverso: tira uma coluna que ficou pra trás de uma versão anterior. O
// libSQL (fork do SQLite ≥ 3.35) suporta DROP COLUMN direto.
async function removerColuna(db, tabela, coluna) {
  if ((await colunas(db, tabela)).includes(coluna)) {
    await db.execute(`ALTER TABLE ${tabela} DROP COLUMN ${coluna}`);
  }
}

export async function abrirBanco(url = ':memory:', authToken = undefined) {
  const db = createClient(authToken ? { url, authToken } : { url });
  await db.executeMultiple(SCHEMA);
  await garantirColuna(db, 'sessoes', 'duracao_ms', 'INTEGER NOT NULL DEFAULT 43200000');
  await garantirColuna(db, 'leads', 'palestrantes', 'TEXT');
  await garantirColuna(db, 'leads', 'checkin_em', 'TEXT');
  await garantirColuna(db, 'leads', 'closer', 'TEXT');
  // `chave_diff` não pode ter DEFAULT sensato (é composta de outras colunas) —
  // quem já tinha um banco sem ela ganha um valor único provisório por linha
  // (o `id`, que já é único), e a próxima sincronização substitui pelo valor
  // de verdade de qualquer forma.
  await garantirColuna(db, 'leads', 'chave_diff', "TEXT NOT NULL DEFAULT ''");
  await db.execute("UPDATE leads SET chave_diff = 'migracao-' || id WHERE chave_diff = ''");
  await garantirColuna(db, 'sincronizacao', 'duplicados', 'INTEGER NOT NULL DEFAULT 0');
  // `instrutor` era a atribuição vinda do campo Conexao; a atribuição agora sai
  // de Palestrante (coluna `palestrantes` acima). A próxima sincronização já
  // reescreve a tabela inteira, então tirar a coluna velha não perde nada.
  await removerColuna(db, 'leads', 'instrutor');
  return db;
}

let padrao = null;

export function bancoPadrao() {
  if (!padrao) {
    padrao = (async () => {
      const url = config.tursoUrl
        ?? `file:${path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', config.dbArquivo)}`;
      const db = await abrirBanco(url, config.tursoToken);
      await semearCrmPipelines(db);
      return db;
    })();
  }
  return padrao;
}
