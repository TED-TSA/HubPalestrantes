import { lerCookies } from './cookie.js';
import { COOKIE_SESSAO, lerSessao } from './sessao.js';

// Anexa req.usuario quando houver sessão válida. Nunca bloqueia — quem bloqueia
// são os dois middlewares abaixo, para que rotas públicas (login) usem o mesmo.
export function comUsuario(db) {
  return (req, _res, next) => {
    const id = lerCookies(req.headers.cookie)[COOKIE_SESSAO];
    req.sessaoId = id ?? null;
    req.usuario = lerSessao(db, id);
    next();
  };
}

export function exigirLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

export function exigirAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito' });
  next();
}
