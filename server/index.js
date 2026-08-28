import { criarApp } from './app.js';
import { bancoPadrao } from './data/db.js';
import { sincronizar, ultimaSincronizacao } from './data/sincronizacao.js';
import { runQuery } from './data/bq.js';
import { semearAdmin } from './data/seed.js';
import { config } from '../config.js';

const db = bancoPadrao();
// Antes de servir: garante um admin quando ADMIN_EMAIL/ADMIN_SENHA existem.
// Sem as variáveis é um no-op, então em desenvolvimento nada muda.
semearAdmin(db);
const app = criarApp({ db });

// A tela lê do espelho em SQLite; quem fala com o BigQuery é só isto aqui.
// Assim nenhuma pessoa espera os ~15s da consulta, e o dado sobrevive a
// reinício do servidor: ao subir, o que está em disco já serve.
async function atualizar(motivo) {
  const inicio = Date.now();
  try {
    const r = await sincronizar(db, { runQuery });
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`[sync ${motivo}] ${r.palestras} palestras, ${r.leads} leads em ${s}s`
      + (r.semPalestra ? ` · ${r.semPalestra} leads sem palestra correspondente` : ''));
  } catch (e) {
    // Falhar aqui não derruba a tela: ela continua servindo o que já está no
    // banco, e a próxima rodada tenta de novo.
    console.error(`[sync ${motivo}] falhou: ${e.message}`);
  }
}

app.listen(config.port, () => {
  console.log(`Hub do Palestrante em http://localhost:${config.port}`);
  const anterior = ultimaSincronizacao(db);
  console.log(anterior
    ? `Servindo os dados de ${anterior.em}; atualizando em segundo plano.`
    : 'Banco vazio: buscando os dados pela primeira vez.');

  atualizar('inicial');
  setInterval(() => atualizar('periódico'), config.sincronizacaoMs).unref();
});
