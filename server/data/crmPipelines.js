import { pipelinesUnnichat } from './pipelinesUnnichat.js';

export async function listar(db) {
  const { rows } = await db.execute('SELECT * FROM crm_pipelines ORDER BY pipeline_nome, etapa_nome');
  return rows;
}

export async function criar(db, { pipelineNome, pipelineId, etapaNome, colunaId }) {
  const info = await db.execute({
    sql: `INSERT INTO crm_pipelines (pipeline_nome, pipeline_id, etapa_nome, coluna_id)
    VALUES (?, ?, ?, ?)`,
    args: [pipelineNome, pipelineId, etapaNome, colunaId],
  });
  const { rows } = await db.execute({
    sql: 'SELECT * FROM crm_pipelines WHERE id = ?',
    args: [Number(info.lastInsertRowid)],
  });
  return rows[0];
}

export async function remover(db, id) {
  await db.execute({ sql: 'DELETE FROM crm_pipelines WHERE id = ?', args: [id] });
}

// Formato que server/data/reconciliarUnnichat.js espera: uma entrada por
// pipeline, com o mapa etapa -> coluna dentro.
export async function comoMapa(db) {
  const mapa = {};
  for (const l of await listar(db)) {
    (mapa[l.pipeline_nome] ??= { pipelineId: l.pipeline_id, colunas: {} }).colunas[l.etapa_nome] = l.coluna_id;
  }
  return mapa;
}

// Primeira carga da tabela nova a partir do que já tínhamos em arquivo
// (levantado à mão em 28/08/2026 — ver pipelinesUnnichat.js). Só roda se a
// tabela estiver vazia, então editar/apagar pela tela de admin não volta.
export async function semear(db) {
  if ((await listar(db)).length) return;
  for (const [pipelineNome, info] of Object.entries(pipelinesUnnichat)) {
    for (const [etapaNome, colunaId] of Object.entries(info.colunas)) {
      await criar(db, { pipelineNome, pipelineId: info.pipelineId, etapaNome, colunaId });
    }
  }
}
