import { SQL_LEADS, SQL_VENDAS } from './queries.js';
import { leadsExemplo, vendasExemplo } from './exemplo.js';
import { cached } from './cache.js';
import { config } from '../../config.js';
import { indexarVendas } from '../domain/vendas.js';
import { enriquecerLeads, resumoEvento, resumoInstrutores } from '../domain/metricas.js';
import { montarColunas } from '../domain/kanban.js';
import { slug } from '../domain/texto.js';

export async function carregarTudo(deps) {
  if (config.usarExemplo) {
    return enriquecerLeads(leadsExemplo, indexarVendas(vendasExemplo));
  }
  return cached('leads-enriquecidos', config.cacheTtlMs, async () => {
    const [leadsRaw, vendasRaw] = await Promise.all([
      deps.runQuery(SQL_LEADS),
      deps.runQuery(SQL_VENDAS),
    ]);
    return enriquecerLeads(leadsRaw, indexarVendas(vendasRaw));
  });
}

// O recorte por instrutor acontece aqui, antes de qualquer coisa virar JSON.
// Se isto vivesse no frontend, os leads dos colegas viajariam no payload.
function visiveisPara(leads, usuario) {
  if (!usuario || usuario.papel === 'admin') return leads;
  const meus = new Set(usuario.vinculos ?? []);
  return leads.filter((l) => meus.has(l.instrutor));
}

function agruparPorEvento(leads) {
  const grupos = new Map();
  for (const l of leads) {
    if (!grupos.has(l.evento)) grupos.set(l.evento, []);
    grupos.get(l.evento).push(l);
  }
  return grupos;
}

export async function listarEventos(deps, usuario) {
  const leads = visiveisPara(await carregarTudo(deps), usuario);
  return [...agruparPorEvento(leads).entries()]
    .map(([evento, ls]) => ({
      evento, slug: slug(evento),
      ...resumoEvento(ls),
      // Mesmo formato do detalhe (nome, slug e métricas): o card da home precisa
      // do slug para achar a foto, e os números alimentam o tooltip.
      instrutores: resumoInstrutores(ls),
    }))
    .sort((a, b) => b.total - a.total);
}

export async function detalheEvento(eventoSlug, deps, usuario) {
  const leads = visiveisPara(await carregarTudo(deps), usuario);
  const doEvento = leads.filter((l) => slug(l.evento) === eventoSlug);
  // Para um instrutor sem lead no evento, ele simplesmente não existe: mesmo 404
  // de um slug inventado, sem revelar que o evento existe para outra pessoa.
  if (doEvento.length === 0) return { evento: null };
  return {
    evento: doEvento[0].evento,
    resumo: resumoEvento(doEvento),
    instrutores: resumoInstrutores(doEvento),
    colunas: montarColunas(doEvento),
  };
}

// Nomes de instrutor que realmente aparecem nos dados — alimenta a escolha
// guiada do cadastro, para que ninguém digite a grafia errada.
export async function nomesDeConexao(deps) {
  const leads = await carregarTudo(deps);
  return [...new Set(leads.map((l) => l.instrutor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
