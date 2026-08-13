import { SQL_LEADS, SQL_LEADS_DESCARTADOS, SQL_PALESTRAS } from './queries.js';
import { leadsExemplo, palestrasExemplo } from './exemplo.js';
import { cached } from './cache.js';
import { config } from '../../config.js';
import { enriquecerLeads, resumoEvento } from '../domain/metricas.js';
import { montarColunas } from '../domain/kanban.js';
import { montarPalestra, cidadeDoPipeline, indexarPalestrasPorCidade } from '../domain/palestra.js';
import { slug } from '../domain/texto.js';

async function buscar(deps) {
  if (config.usarExemplo) {
    return {
      palestras: palestrasExemplo.map(montarPalestra),
      leads: enriquecerLeads(leadsExemplo),
      descartados: 0,
    };
  }
  const [palestrasRaw, leadsRaw, contagem] = await Promise.all([
    deps.runQuery(SQL_PALESTRAS),
    deps.runQuery(SQL_LEADS),
    deps.runQuery(SQL_LEADS_DESCARTADOS),
  ]);
  return {
    palestras: palestrasRaw.map(montarPalestra),
    leads: enriquecerLeads(leadsRaw),
    descartados: Number(contagem?.[0]?.descartados ?? 0),
  };
}

// Cada palestra recebe os leads da sua cidade. Um lead sem Conexão não tem dono
// individual: ele pertence a quem subiu ao palco naquela palestra. É a única
// atribuição possível, já que 298 dos 308 leads vêm sem esse campo.
export async function carregarTudo(deps) {
  const monta = async () => {
    const { palestras, leads, descartados } = await buscar(deps);
    const porCidade = indexarPalestrasPorCidade(palestras);
    const leadsDaPalestra = new Map(palestras.map((p) => [p.slug, []]));

    let semPalestra = 0;
    for (const l of leads) {
      const p = porCidade.get(slug(cidadeDoPipeline(l.evento)));
      if (!p) { semPalestra += 1; continue; }
      l.donos = l.instrutorConhecido ? [l.instrutor] : p.palestrantes;
      leadsDaPalestra.get(p.slug).push(l);
    }
    for (const p of palestras) p.leads = leadsDaPalestra.get(p.slug) ?? [];
    return { palestras, descartados, semPalestra };
  };

  if (config.usarExemplo) return monta();
  return cached('palestras', config.cacheTtlMs, monta);
}

// O recorte por instrutor acontece aqui, antes de qualquer coisa virar JSON.
// Se isto vivesse no frontend, os dados dos colegas viajariam no payload.
function visiveis(palestras, usuario) {
  if (!usuario || usuario.papel === 'admin') return palestras;
  const meus = new Set(usuario.vinculos ?? []);
  return palestras
    .filter((p) => p.palestrantes.some((n) => meus.has(n)))
    .map((p) => ({ ...p, leads: p.leads.filter((l) => l.donos.some((n) => meus.has(n))) }));
}

function porInstrutor(palestra) {
  return palestra.palestrantes.map((nome) => {
    const ls = palestra.leads.filter((l) => l.donos.includes(nome));
    return { instrutor: nome, slug: slug(nome), ...resumoEvento(ls) };
  });
}

function resumoDaPalestra(p) {
  return {
    cidade: p.cidade, data: p.data, slug: p.slug,
    cadastrados: p.cadastrados, presentes: p.presentes, pctPresenca: p.pctPresenca,
    vendas: p.vendas, vendasTotais: p.vendasTotais, vendasAPagar: p.vendasAPagar,
    canceladas: p.canceladas, conversao: p.conversao,
    presentesTribo: p.presentesTribo, presentesAldeia: p.presentesAldeia, presentesLead: p.presentesLead,
    leads: p.leads.length,
    instrutores: porInstrutor(p),
  };
}

export async function listarEventos(deps, usuario) {
  const { palestras } = await carregarTudo(deps);
  return visiveis(palestras, usuario)
    .map(resumoDaPalestra)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export async function detalheEvento(eventoSlug, deps, usuario) {
  const { palestras } = await carregarTudo(deps);
  const p = visiveis(palestras, usuario).find((x) => x.slug === eventoSlug);
  // Para um instrutor que não subiu naquele palco, a palestra simplesmente não
  // existe: mesmo 404 de um slug inventado.
  if (!p) return { evento: null };
  return {
    ...resumoDaPalestra(p),
    resumo: resumoEvento(p.leads),
    colunas: montarColunas(p.leads),
  };
}

// Números que a gestão precisa ver para cobrar a origem dos dados.
export async function saude(deps) {
  const { descartados, semPalestra } = await carregarTudo(deps);
  return { descartados, semPalestra };
}

// Nomes de palestrante que realmente aparecem nos dados — alimenta a escolha
// guiada do cadastro, para que ninguém digite a grafia errada.
export async function nomesDeConexao(deps) {
  const { palestras } = await carregarTudo(deps);
  const nomes = new Set();
  for (const p of palestras) for (const n of p.palestrantes) nomes.add(n);
  for (const p of palestras) for (const l of p.leads) if (l.instrutorConhecido) nomes.add(l.instrutor);
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
