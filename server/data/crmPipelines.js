import { pipelinesUnnichat } from './pipelinesUnnichat.js';

export function listar(db) {
  return db.prepare('SELECT * FROM crm_pipelines ORDER BY pipeline_nome, etapa_nome').all();
}

export function criar(db, { pipelineNome, pipelineId, etapaNome, colunaId }) {
  const info = db.prepare(`INSERT INTO crm_pipelines (pipeline_nome, pipeline_id, etapa_nome, coluna_id)
    VALUES (?, ?, ?, ?)`).run(pipelineNome, pipelineId, etapaNome, colunaId);
  return db.prepare('SELECT * FROM crm_pipelines WHERE id = ?').get(info.lastInsertRowid);
}

export function remover(db, id) {
  db.prepare('DELETE FROM crm_pipelines WHERE id = ?').run(id);
}

// Formato que server/data/reconciliarUnnichat.js espera: uma entrada por
// pipeline, com o mapa etapa -> coluna dentro.
export function comoMapa(db) {
  const mapa = {};
  for (const l of listar(db)) {
    (mapa[l.pipeline_nome] ??= { pipelineId: l.pipeline_id, colunas: {} }).colunas[l.etapa_nome] = l.coluna_id;
  }
  return mapa;
}

// Primeira carga da tabela nova a partir do que já tínhamos em arquivo
// (levantado à mão em 28/08/2026 — ver pipelinesUnnichat.js). Só roda se a
// tabela estiver vazia, então editar/apagar pela tela de admin não volta.
export function semear(db) {
  if (listar(db).length) return;
  for (const [pipelineNome, info] of Object.entries(pipelinesUnnichat)) {
    for (const [etapaNome, colunaId] of Object.entries(info.colunas)) {
      criar(db, { pipelineNome, pipelineId: info.pipelineId, etapaNome, colunaId });
    }
  }
}
