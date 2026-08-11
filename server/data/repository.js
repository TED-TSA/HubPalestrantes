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

function agruparPorEvento(leads) {
  const grupos = new Map();
  for (const l of leads) {
    if (!grupos.has(l.evento)) grupos.set(l.evento, []);
    grupos.get(l.evento).push(l);
  }
  return grupos;
}

export async function listarEventos(deps) {
  const leads = await carregarTudo(deps);
  return [...agruparPorEvento(leads).entries()]
    .map(([evento, ls]) => ({
      evento, slug: slug(evento),
      ...resumoEvento(ls),
      instrutores: [...new Set(ls.map((l) => l.instrutor))],
    }))
    .sort((a, b) => b.total - a.total);
}

export async function detalheEvento(eventoSlug, deps) {
  const leads = await carregarTudo(deps);
  const doEvento = leads.filter((l) => slug(l.evento) === eventoSlug);
  if (doEvento.length === 0) return { evento: null };
  return {
    evento: doEvento[0].evento,
    resumo: resumoEvento(doEvento),
    instrutores: resumoInstrutores(doEvento),
    colunas: montarColunas(doEvento),
  };
}
