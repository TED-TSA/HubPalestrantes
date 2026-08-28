// Carga diária de leads-ts.Presenciais.Guests, fora do processo do servidor —
// roda como job separado (cron/Task Scheduler), não como setInterval dentro
// do Hub, porque o retorno da esteira é grande e não deve competir por
// memória/CPU com quem está servindo a tela.
//
//   GUESTS_BI_TOKEN=... node scripts/sincronizar-guests.js
//
import { sincronizarGuests } from '../server/data/guests.js';

const inicio = Date.now();
try {
  const { total } = await sincronizarGuests();
  console.log(`[guests] ok: ${total} itens carregados em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
} catch (e) {
  console.error(`[guests] falhou: ${e.message}`);
  process.exit(1);
}
