import { SQL_LEADS, SQL_PALESTRAS } from './queries.js';
import { leadsExemplo, palestrasExemplo } from './exemplo.js';
import { config } from '../../config.js';
import { enriquecerLeads, deduplicarLeads } from '../domain/metricas.js';
import {
  montarPalestra, cidadeDoPipeline, indexarPalestrasPorCidade,
  parseCodigoEvento, indexarPalestrasPorSigla, resolverPorCodigoEvento,
} from '../domain/palestra.js';
import { slug, ehVazio } from '../domain/texto.js';

async function buscar(deps) {
  if (config.usarExemplo) {
    return { palestrasRaw: palestrasExemplo, leadsRaw: leadsExemplo };
  }
  const [palestrasRaw, leadsRaw] = await Promise.all([
    deps.runQuery(SQL_PALESTRAS),
    deps.runQuery(SQL_LEADS),
  ]);
  return { palestrasRaw, leadsRaw };
}

// Puxa do BigQuery e reescreve o espelho local. A troca acontece dentro de uma
// transação: quem estiver lendo no meio da sincronização vê o conjunto antigo
// inteiro ou o novo inteiro, nunca uma mistura.
export async function sincronizar(db, deps) {
  const { palestrasRaw, leadsRaw } = await buscar(deps);

  const palestras = (palestrasRaw ?? []).map(montarPalestra);
  const brutos = leadsRaw ?? [];
  // Lead sem evento ou sem etapa não tem onde aparecer. O número vai para a
  // tela da gestão, para o problema não passar despercebido.
  const aproveitaveis = brutos.filter((l) => !ehVazio(l.PipelineName) && !ehVazio(l.EtapaName));
  const leads = enriquecerLeads(aproveitaveis);

  const porCidade = indexarPalestrasPorCidade(palestras);
  const porSigla = indexarPalestrasPorSigla(palestras);
  const comPalestra = [];
  let semPalestra = 0;
  for (const l of leads) {
    // Três tentativas, da mais confiável pra mais incerta. `PipelineName` vem
    // primeiro (formato fixo desde 21/08/2026 — "Presencial Balneário
    // Camboriú - [1008] BAL"): é estrutural, uma coisa por negócio, não pode
    // estar errado. `eventName` (upload de histórico, 20/08/2026) vem depois,
    // só pra leads antigos sem código no PipelineName — ele é solto e pode
    // carregar resíduo de outra campanha (contato que passou por Palmas antes
    // de virar lead de Blumenau, por exemplo — visto na prática em 28/08/2026,
    // ~100 leads de Blumenau com `eventName` de Palmas roubando o card errado
    // quando checado primeiro). Só cai no fallback de cidade (a aposta na mais
    // recente) quando nenhum dos dois resolve.
    const p = resolverPorCodigoEvento(parseCodigoEvento(l.evento), porSigla)
      ?? resolverPorCodigoEvento(parseCodigoEvento(l.eventName), porSigla)
      ?? porCidade.get(slug(cidadeDoPipeline(l.evento)));
    if (!p) { semPalestra += 1; continue; }
    comPalestra.push([p.slug, l]);
  }
  // A origem manda a mesma pessoa mais de uma vez às vezes — até 3x, visto na
  // base real. O número que se perde aqui vai pro aviso da gestão, mesmo
  // motivo do descartados/semPalestra: não sumir sem ninguém perceber.
  const deduplicados = deduplicarLeads(comPalestra);
  const duplicados = comPalestra.length - deduplicados.length;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM leads');
    db.exec('DELETE FROM palestras');

    const insP = db.prepare(`INSERT INTO palestras
      (slug, cidade, data, palestrantes, cadastrados, presentes, presentes_tribo,
       presentes_aldeia, presentes_lead, pct_presenca, vendas, vendas_totais,
       vendas_a_pagar, canceladas, conversao)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of palestras) {
      insP.run(p.slug, p.cidade, p.data, JSON.stringify(p.palestrantes),
        p.cadastrados, p.presentes, p.presentesTribo, p.presentesAldeia, p.presentesLead,
        p.pctPresenca, p.vendas, p.vendasTotais, p.vendasAPagar, p.canceladas, p.conversao);
    }

    const insL = db.prepare(`INSERT INTO leads
      (palestra_slug, nome, telefone, email, etapa, palestrantes, checkin_em, closer)
      VALUES (?,?,?,?,?,?,?,?)`);
    for (const [slugPalestra, l] of deduplicados) {
      insL.run(slugPalestra, l.nome, l.telefone || null, l.email || null, l.etapaName,
        l.palestrantes ? JSON.stringify(l.palestrantes) : null, l.checkinEm, l.closer);
    }

    db.prepare(`INSERT INTO sincronizacao (id, em, descartados, sem_palestra, duplicados)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET em = excluded.em,
        descartados = excluded.descartados, sem_palestra = excluded.sem_palestra,
        duplicados = excluded.duplicados`)
      .run(new Date().toISOString(), brutos.length - aproveitaveis.length, semPalestra, duplicados);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { palestras: palestras.length, leads: deduplicados.length, semPalestra, duplicados };
}

export function ultimaSincronizacao(db) {
  return db.prepare('SELECT em, descartados, sem_palestra, duplicados FROM sincronizacao WHERE id = 1').get() ?? null;
}
