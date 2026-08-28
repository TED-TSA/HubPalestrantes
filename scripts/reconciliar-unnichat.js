// Puxa direto do CRM do Unnichat (todo pipeline/coluna conhecido em
// server/data/pipelinesUnnichat.js) e escreve em info_leads o que o webhook
// do n8n perdeu ou deixou desatualizado. Roda sob demanda por enquanto — vira
// job agendado quando a aba de admin (mapa pipeline/coluna) existir.
//
//   UNNICHAT_TOKEN=... node scripts/reconciliar-unnichat.js
//
import { reconciliar } from '../server/data/reconciliarUnnichat.js';

const inicio = Date.now();
try {
  const r = await reconciliar();
  const s = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`[reconciliar] ${r.negociosVistos} negócios vistos, ${r.faltando} novos, ${r.desatualizados} com etapa corrigida, em ${s}s`);
} catch (e) {
  console.error(`[reconciliar] falhou: ${e.message}`);
  process.exit(1);
}
