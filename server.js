// Entrypoint que a Vercel detecta sozinha (zero-config: procura por
// server.{js,ts} na raiz e espera um `export default` do app Express — ver
// https://vercel.com/docs/frameworks/backend/express). Diferente de
// server/index.js (usado por `npm start`/`npm run dev`), este arquivo não dá
// `app.listen` nem agenda sincronização em segundo plano: na Vercel não existe
// processo de pé pra segurar um `setInterval` — isso virou a rota
// GET /api/cron/sincronizar (server/routes.js), disparada de fora.
import { criarApp } from './server/app.js';
import { bancoPadrao } from './server/data/db.js';
import { semearAdmin } from './server/data/seed.js';

const db = await bancoPadrao();
await semearAdmin(db);

export default criarApp({ db });
