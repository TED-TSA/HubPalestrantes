import { Router } from 'express';
import * as repo from './data/repository.js';
import * as usuarios from './data/usuarios.js';
import * as crmPipelines from './data/crmPipelines.js';
import { conferirSenha, senhaAceitavel } from './auth/senha.js';
import {
  criarSessao, destruirSessao, cookieDeSessao, cookieDeSaida,
  DURACAO_MS, DURACAO_LONGA_MS,
} from './auth/sessao.js';
import { exigirLogin, exigirAdmin } from './auth/middleware.js';
import { bloqueado, registrarFalha, limparFalhas } from './auth/limite.js';
import { sincronizar } from './data/sincronizacao.js';
import { runQuery } from './data/bq.js';
import { config } from '../config.js';

export function criarRotas({ db }) {
  const r = Router();

  r.get('/health', (_req, res) => res.json({ ok: true }));

  // Substitui o setInterval de server/index.js na Vercel, onde não existe
  // processo de pé pra segurar um timer: um agendador de fora (GitHub Actions,
  // ver .github/workflows/sincronizar.yml) bate aqui a cada 15 min. Protegido
  // por segredo — nunca sessão de usuário, isso não é uma rota de tela.
  r.get('/cron/sincronizar', async (req, res, next) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ erro: 'Não autorizado' });
      }
      res.json(await sincronizar(db, { runQuery }));
    } catch (e) { next(e); }
  });

  r.post('/login', async (req, res, next) => {
    try {
      const email = usuarios.normalizarEmail(req.body?.email);
      const senha = String(req.body?.senha ?? '');
      const chave = `${email}|${req.ip}`;
      if (bloqueado(chave)) {
        return res.status(429).json({ erro: 'Muitas tentativas. Tente de novo em alguns minutos.' });
      }
      const usuario = email ? await usuarios.porEmail(db, email) : null;
      // Mensagem sempre igual: dizer qual campo falhou transforma a tela num
      // validador de quem trabalha na empresa.
      if (!usuario || !usuario.ativo || !conferirSenha(senha, usuario.senha_hash)) {
        registrarFalha(chave);
        return res.status(401).json({ erro: 'Email ou senha inválidos' });
      }
      limparFalhas(chave);
      const manter = req.body?.manterConectado === true;
      const id = await criarSessao(db, usuario.id, Date.now(), manter ? DURACAO_LONGA_MS : DURACAO_MS);
      res.setHeader('Set-Cookie', cookieDeSessao(id, config.cookieSeguro, manter));
      res.json({ usuario: usuarios.paraCliente(usuario) });
    } catch (e) { next(e); }
  });

  r.post('/logout', async (req, res, next) => {
    try {
      await destruirSessao(db, req.sessaoId);
      res.setHeader('Set-Cookie', cookieDeSaida(config.cookieSeguro));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get('/eu', exigirLogin, (req, res) => {
    res.json({ usuario: usuarios.paraCliente(req.usuario) });
  });

  r.post('/trocar-senha', exigirLogin, async (req, res, next) => {
    try {
      const atual = String(req.body?.senhaAtual ?? '');
      const nova = String(req.body?.novaSenha ?? '');
      if (!conferirSenha(atual, req.usuario.senha_hash)) {
        return res.status(400).json({ erro: 'Senha atual incorreta' });
      }
      if (!senhaAceitavel(nova)) {
        return res.status(400).json({ erro: 'A nova senha precisa ter ao menos 8 caracteres' });
      }
      // Mantém a sessão de quem está trocando; derruba as outras.
      await usuarios.trocarSenha(db, req.usuario.id, nova, { manterSessoes: true });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get('/eventos', exigirLogin, async (req, res, next) => {
    try { res.json(await repo.listarEventos(db, req.usuario)); } catch (e) { next(e); }
  });

  r.get('/eventos/:slug', exigirLogin, async (req, res, next) => {
    try {
      const d = await repo.detalheEvento(db, req.params.slug, req.usuario);
      // A palestra encontrada traz slug; a não encontrada vem vazia.
      if (!d.slug) return res.status(404).json({ erro: 'Palestra não encontrada' });
      res.json(d);
    } catch (e) { next(e); }
  });

  r.get('/admin/usuarios', exigirAdmin, async (_req, res, next) => {
    try { res.json((await usuarios.listar(db)).map(usuarios.paraCliente)); } catch (e) { next(e); }
  });

  r.post('/admin/usuarios', exigirAdmin, async (req, res, next) => {
    try {
      const { email, nome, senha, papel, vinculos } = req.body ?? {};
      if (!senhaAceitavel(senha)) {
        return res.status(400).json({ erro: 'A senha precisa ter ao menos 8 caracteres' });
      }
      res.status(201).json(usuarios.paraCliente(await usuarios.criar(db, { email, nome, senha, papel, vinculos })));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ erro: 'Já existe usuário com esse email' });
      if (e instanceof Error && !e.code) return res.status(400).json({ erro: e.message });
      next(e);
    }
  });

  r.put('/admin/usuarios/:id', exigirAdmin, async (req, res, next) => {
    try {
      const { nome, papel, ativo, vinculos } = req.body ?? {};
      const atualizado = await usuarios.atualizar(db, Number(req.params.id), { nome, papel, ativo, vinculos });
      res.json(usuarios.paraCliente(atualizado));
    } catch (e) {
      if (e instanceof Error && !e.code) return res.status(400).json({ erro: e.message });
      next(e);
    }
  });

  r.post('/admin/usuarios/:id/senha', exigirAdmin, async (req, res, next) => {
    try {
      const senha = String(req.body?.senha ?? '');
      if (!senhaAceitavel(senha)) {
        return res.status(400).json({ erro: 'A senha precisa ter ao menos 8 caracteres' });
      }
      await usuarios.resetarSenha(db, Number(req.params.id), senha);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Quantos leads a origem está mandando quebrados. Sem isto, metade da base
  // sumiria da tela sem ninguém perceber.
  r.get('/admin/saude', exigirAdmin, async (_req, res, next) => {
    try { res.json(await repo.saude(db)); } catch (e) { next(e); }
  });

  // Nomes de palestrante que aparecem nos dados, marcando quem ainda não tem
  // dono. É o que impede um instrutor de logar numa tela vazia por causa de grafia.
  r.get('/admin/nomes', exigirAdmin, async (_req, res, next) => {
    try {
      const nomes = await repo.nomesDePalestrante(db);
      res.json(await Promise.all(nomes.map(async (nome) => {
        const dono = await usuarios.donoDoNome(db, nome);
        return { nome, dono: dono ? { id: dono.id, nome: dono.nome } : null };
      })));
    } catch (e) { next(e); }
  });

  // Mapa pipeline/coluna do CRM do Unnichat, usado pela reconciliação direta
  // na API (a UnniAPI não tem endpoint de listagem — só sabemos os IDs que
  // alguém cadastrar aqui). Ver server/data/reconciliarUnnichat.js.
  r.get('/admin/crm-pipelines', exigirAdmin, async (_req, res, next) => {
    try { res.json(await crmPipelines.listar(db)); } catch (e) { next(e); }
  });

  r.post('/admin/crm-pipelines', exigirAdmin, async (req, res, next) => {
    try {
      const { pipelineNome, pipelineId, etapaNome, colunaId } = req.body ?? {};
      if (!pipelineNome || !pipelineId || !etapaNome || !colunaId) {
        return res.status(400).json({ erro: 'Preencha pipeline, pipelineId, etapa e colunaId' });
      }
      res.status(201).json(await crmPipelines.criar(db, { pipelineNome, pipelineId, etapaNome, colunaId }));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ erro: 'Essa coluna já está cadastrada para esse pipeline' });
      }
      next(e);
    }
  });

  r.delete('/admin/crm-pipelines/:id', exigirAdmin, async (req, res, next) => {
    try {
      await crmPipelines.remover(db, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
}
