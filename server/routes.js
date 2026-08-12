import { Router } from 'express';
import * as repo from './data/repository.js';
import * as usuarios from './data/usuarios.js';
import { runQuery } from './data/bq.js';
import { conferirSenha, senhaAceitavel } from './auth/senha.js';
import {
  criarSessao, destruirSessao, cookieDeSessao, cookieDeSaida,
  DURACAO_MS, DURACAO_LONGA_MS,
} from './auth/sessao.js';
import { exigirLogin, exigirAdmin } from './auth/middleware.js';
import { bloqueado, registrarFalha, limparFalhas } from './auth/limite.js';
import { config } from '../config.js';

export function criarRotas(deps = { runQuery }) {
  const db = deps.db;
  const r = Router();

  r.get('/health', (_req, res) => res.json({ ok: true }));

  r.post('/login', (req, res) => {
    const email = usuarios.normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha ?? '');
    const chave = `${email}|${req.ip}`;
    if (bloqueado(chave)) {
      return res.status(429).json({ erro: 'Muitas tentativas. Tente de novo em alguns minutos.' });
    }
    const usuario = email ? usuarios.porEmail(db, email) : null;
    // Mensagem sempre igual: dizer qual campo falhou transforma a tela num
    // validador de quem trabalha na empresa.
    if (!usuario || !usuario.ativo || !conferirSenha(senha, usuario.senha_hash)) {
      registrarFalha(chave);
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }
    limparFalhas(chave);
    const manter = req.body?.manterConectado === true;
    const id = criarSessao(db, usuario.id, Date.now(), manter ? DURACAO_LONGA_MS : DURACAO_MS);
    res.setHeader('Set-Cookie', cookieDeSessao(id, config.cookieSeguro, manter));
    res.json({ usuario: usuarios.paraCliente(usuario) });
  });

  r.post('/logout', (req, res) => {
    destruirSessao(db, req.sessaoId);
    res.setHeader('Set-Cookie', cookieDeSaida(config.cookieSeguro));
    res.json({ ok: true });
  });

  r.get('/eu', exigirLogin, (req, res) => {
    res.json({ usuario: usuarios.paraCliente(req.usuario) });
  });

  r.post('/trocar-senha', exigirLogin, (req, res) => {
    const atual = String(req.body?.senhaAtual ?? '');
    const nova = String(req.body?.novaSenha ?? '');
    if (!conferirSenha(atual, req.usuario.senha_hash)) {
      return res.status(400).json({ erro: 'Senha atual incorreta' });
    }
    if (!senhaAceitavel(nova)) {
      return res.status(400).json({ erro: 'A nova senha precisa ter ao menos 8 caracteres' });
    }
    // Mantém a sessão de quem está trocando; derruba as outras.
    usuarios.trocarSenha(db, req.usuario.id, nova, { manterSessoes: true });
    res.json({ ok: true });
  });

  r.get('/eventos', exigirLogin, async (req, res, next) => {
    try { res.json(await repo.listarEventos(deps, req.usuario)); } catch (e) { next(e); }
  });

  r.get('/eventos/:slug', exigirLogin, async (req, res, next) => {
    try {
      const d = await repo.detalheEvento(req.params.slug, deps, req.usuario);
      if (!d.evento) return res.status(404).json({ erro: 'Evento não encontrado' });
      res.json(d);
    } catch (e) { next(e); }
  });

  r.get('/admin/usuarios', exigirAdmin, (_req, res) => {
    res.json(usuarios.listar(db).map(usuarios.paraCliente));
  });

  r.post('/admin/usuarios', exigirAdmin, (req, res, next) => {
    try {
      const { email, nome, senha, papel, vinculos } = req.body ?? {};
      if (!senhaAceitavel(senha)) {
        return res.status(400).json({ erro: 'A senha precisa ter ao menos 8 caracteres' });
      }
      res.status(201).json(usuarios.paraCliente(usuarios.criar(db, { email, nome, senha, papel, vinculos })));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ erro: 'Já existe usuário com esse email' });
      if (e instanceof Error && !e.code) return res.status(400).json({ erro: e.message });
      next(e);
    }
  });

  r.put('/admin/usuarios/:id', exigirAdmin, (req, res, next) => {
    try {
      const { nome, papel, ativo, vinculos } = req.body ?? {};
      res.json(usuarios.paraCliente(usuarios.atualizar(db, Number(req.params.id), { nome, papel, ativo, vinculos })));
    } catch (e) {
      if (e instanceof Error && !e.code) return res.status(400).json({ erro: e.message });
      next(e);
    }
  });

  r.post('/admin/usuarios/:id/senha', exigirAdmin, (req, res, next) => {
    try {
      const senha = String(req.body?.senha ?? '');
      if (!senhaAceitavel(senha)) {
        return res.status(400).json({ erro: 'A senha precisa ter ao menos 8 caracteres' });
      }
      usuarios.resetarSenha(db, Number(req.params.id), senha);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Nomes que aparecem no Conexao, marcando quem ainda não tem dono. É o que
  // impede um instrutor de logar numa tela vazia por causa de grafia.
  r.get('/admin/nomes', exigirAdmin, async (_req, res, next) => {
    try {
      const nomes = await repo.nomesDeConexao(deps);
      res.json(nomes.map((nome) => {
        const dono = usuarios.donoDoNome(db, nome);
        return { nome, dono: dono ? { id: dono.id, nome: dono.nome } : null };
      }));
    } catch (e) { next(e); }
  });

  return r;
}
