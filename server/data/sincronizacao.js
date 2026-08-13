import { SQL_LEADS, SQL_PALESTRAS } from './queries.js';
import { leadsExemplo, palestrasExemplo } from './exemplo.js';
import { config } from '../../config.js';
import { enriquecerLeads } from '../domain/metricas.js';
import { montarPalestra, cidadeDoPipeline, indexarPalestrasPorCidade } from '../domain/palestra.js';
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
  const comPalestra = [];
  let semPalestra = 0;
  for (const l of leads) {
    const p = porCidade.get(slug(cidadeDoPipeline(l.evento)));
    if (!p) { semPalestra += 1; continue; }
    comPalestra.push([p.slug, l]);
  }

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
      (palestra_slug, nome, telefone, email, etapa, instrutor) VALUES (?,?,?,?,?,?)`);
    for (const [slugPalestra, l] of comPalestra) {
      insL.run(slugPalestra, l.nome, l.telefone || null, l.email || null, l.etapaName,
        l.instrutorConhecido ? l.instrutor : null);
    }

    db.prepare(`INSERT INTO sincronizacao (id, em, descartados, sem_palestra)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET em = excluded.em,
        descartados = excluded.descartados, sem_palestra = excluded.sem_palestra`)
      .run(new Date().toISOString(), brutos.length - aproveitaveis.length, semPalestra);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { palestras: palestras.length, leads: comPalestra.length, semPalestra };
}

export function ultimaSincronizacao(db) {
  return db.prepare('SELECT em, descartados, sem_palestra FROM sincronizacao WHERE id = 1').get() ?? null;
}
