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

// Statements por lote, não um `batch()` só: o Turso não documenta um teto,
// mas isso evita mandar um payload gigante numa sincronização de primeira
// carga (banco vazio, ~2000 leads de uma vez).
const TAMANHO_LOTE = 300;

async function executarEmLotes(db, stmts) {
  for (let i = 0; i < stmts.length; i += TAMANHO_LOTE) {
    await db.batch(stmts.slice(i, i + TAMANHO_LOTE), 'write');
  }
}

// Chave estável do lead: tudo que identifica a pessoa, sem os campos que ela
// pode legitimamente mudar (etapa, dono, checkin). É o que permite reconhecer
// "mesmo lead, etapa nova" em vez de tratar toda sincronização como gente nova
// — essencial para só escrever o que muda (ver comentário em statementsDeLeads).
function chaveDiff(palestraSlug, l) {
  return [palestraSlug, l.telefone, l.email, l.nome].join('|');
}

// Compara o que já está no banco com o que acabou de vir do BigQuery e monta
// só os INSERT/UPDATE/DELETE necessários. Apagar e reinserir a base inteira a
// cada ciclo de 15 min estourava a cota de escrita do Turso (~10,8M/mês contra
// um teto de 10M, no volume de 31/08/2026) — a var. real por ciclo é uma fração
// pequena disso.
function statementsDeLeads(existentes, deduplicados) {
  const antigos = new Map(existentes.map((l) => [l.chave_diff, l]));
  const vistos = new Set();
  const stmts = [];

  for (const [palestraSlug, l] of deduplicados) {
    const chave = chaveDiff(palestraSlug, l);
    vistos.add(chave);
    const palestrantes = l.palestrantes ? JSON.stringify(l.palestrantes) : null;
    const antigo = antigos.get(chave);

    if (!antigo) {
      stmts.push({
        sql: `INSERT INTO leads (palestra_slug, nome, telefone, email, etapa, palestrantes, checkin_em, closer, chave_diff)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [palestraSlug, l.nome, l.telefone || null, l.email || null, l.etapaName,
          palestrantes, l.checkinEm, l.closer, chave],
      });
      continue;
    }

    const mudou = antigo.etapa !== l.etapaName
      || (antigo.palestrantes ?? null) !== palestrantes
      || (antigo.checkin_em ?? null) !== (l.checkinEm ?? null)
      || (antigo.closer ?? null) !== (l.closer ?? null);
    if (mudou) {
      stmts.push({
        sql: 'UPDATE leads SET etapa = ?, palestrantes = ?, checkin_em = ?, closer = ? WHERE chave_diff = ?',
        args: [l.etapaName, palestrantes, l.checkinEm, l.closer, chave],
      });
    }
  }

  for (const antigo of existentes) {
    if (!vistos.has(antigo.chave_diff)) {
      stmts.push({ sql: 'DELETE FROM leads WHERE chave_diff = ?', args: [antigo.chave_diff] });
    }
  }

  return stmts;
}

// Mesma ideia para palestras, mas por outro motivo além da cota: `leads.palestra_slug`
// tem ON DELETE CASCADE. Um DELETE+INSERT ingênuo de toda palestra a cada
// ciclo apagaria em cascata todo lead vinculado, mesmo de palestra que não
// mudou nada — destruindo o diff de leads acima. Por isso aqui é upsert por
// slug, e só apaga (deixando a cascata agir) quem de fato sumiu da origem.
function statementsDePalestras(slugsExistentes, palestras) {
  const slugsNovos = new Set(palestras.map((p) => p.slug));
  const stmts = palestras.map((p) => ({
    sql: `INSERT INTO palestras
      (slug, cidade, data, palestrantes, cadastrados, presentes, presentes_tribo,
       presentes_aldeia, presentes_lead, pct_presenca, vendas, vendas_totais,
       vendas_a_pagar, canceladas, conversao)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(slug) DO UPDATE SET
        cidade = excluded.cidade, data = excluded.data, palestrantes = excluded.palestrantes,
        cadastrados = excluded.cadastrados, presentes = excluded.presentes,
        presentes_tribo = excluded.presentes_tribo, presentes_aldeia = excluded.presentes_aldeia,
        presentes_lead = excluded.presentes_lead, pct_presenca = excluded.pct_presenca,
        vendas = excluded.vendas, vendas_totais = excluded.vendas_totais,
        vendas_a_pagar = excluded.vendas_a_pagar, canceladas = excluded.canceladas,
        conversao = excluded.conversao`,
    args: [p.slug, p.cidade, p.data, JSON.stringify(p.palestrantes),
      p.cadastrados, p.presentes, p.presentesTribo, p.presentesAldeia, p.presentesLead,
      p.pctPresenca, p.vendas, p.vendasTotais, p.vendasAPagar, p.canceladas, p.conversao],
  }));

  for (const slugAntigo of slugsExistentes) {
    if (!slugsNovos.has(slugAntigo)) {
      stmts.push({ sql: 'DELETE FROM palestras WHERE slug = ?', args: [slugAntigo] });
    }
  }
  return stmts;
}

// Puxa do BigQuery e atualiza o espelho local, escrevendo só o que mudou.
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

  const [{ rows: leadsExistentes }, { rows: palestrasExistentes }] = await Promise.all([
    db.execute('SELECT chave_diff, etapa, palestrantes, checkin_em, closer FROM leads'),
    db.execute('SELECT slug FROM palestras'),
  ]);

  const stmts = [
    ...statementsDePalestras(palestrasExistentes.map((p) => p.slug), palestras),
    ...statementsDeLeads(leadsExistentes, deduplicados),
    {
      sql: `INSERT INTO sincronizacao (id, em, descartados, sem_palestra, duplicados)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET em = excluded.em,
          descartados = excluded.descartados, sem_palestra = excluded.sem_palestra,
          duplicados = excluded.duplicados`,
      args: [new Date().toISOString(), brutos.length - aproveitaveis.length, semPalestra, duplicados],
    },
  ];

  await executarEmLotes(db, stmts);

  return { palestras: palestras.length, leads: deduplicados.length, semPalestra, duplicados };
}

export async function ultimaSincronizacao(db) {
  const { rows } = await db.execute(
    'SELECT em, descartados, sem_palestra, duplicados FROM sincronizacao WHERE id = 1',
  );
  return rows[0] ?? null;
}
