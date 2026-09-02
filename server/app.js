import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes.js';
import { comUsuario } from './auth/middleware.js';

// Lidas uma vez, no boot — nunca mudam em produção, e ler assim (com
// `new URL(caminho, import.meta.url)`, não um `path.join` montado em runtime)
// é o que garante que a Vercel inclua esses dois arquivos no pacote da função:
// o processo de build dela rastreia só o que consegue resolver estaticamente,
// e um `path.join(dir, '..', 'frontend', 'login.html')` variável não entra
// nessa conta. Os demais arquivos estáticos (JS/CSS/imagens/vídeo) não têm
// esse problema porque vivem em public/ — a Vercel serve aquilo direto pelo
// CDN dela, sem passar pela função.
const paginaLogin = readFileSync(new URL('./paginas/login.html', import.meta.url), 'utf8');
const paginaIndex = readFileSync(new URL('./paginas/index.html', import.meta.url), 'utf8');

// `db` já vem aberto (server/index.js resolve `bancoPadrao()` antes de
// chamar isto, e os testes passam o cliente `:memory:` deles) — abrir o
// banco é assíncrono desde a migração pro Turso, então não dá pra ter um
// fallback implícito síncrono aqui.
export function criarApp({ db }) {
  const app = express();

  app.use(express.json());
  app.use(comUsuario(db));
  app.use('/api', criarRotas({ db }));

  // As duas páginas se repelem: quem está logado não volta para o login, e quem
  // não está não vê o app. O frontend também confere via /api/eu, para cobrir
  // quem entrar por outra URL.
  app.get('/login', (req, res) => {
    if (req.usuario) return res.redirect('/');
    res.type('html').send(paginaLogin);
  });
  app.get(['/', '/index.html'], (req, res) => {
    if (!req.usuario) return res.redirect('/login');
    res.type('html').send(paginaIndex);
  });

  // Só serve em dev local (`node server/index.js`): na Vercel, express.static()
  // é ignorado — quem serve public/ lá é o CDN deles, direto, sem passar por
  // aqui. Ver https://vercel.com/docs/frameworks/backend/express#serving-static-assets.
  const dir = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(dir, '..', 'public'), { index: false }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ erro: 'Falha ao consultar os dados' });
  });
  return app;
}
