import { resumoEvento } from '../domain/metricas.js';
import { montarColunas } from '../domain/kanban.js';
import { ultimaSincronizacao } from './sincronizacao.js';
import { slug } from '../domain/texto.js';
import { temFoto } from './fotos.js';

// Tudo aqui lê do espelho local em SQLite, nunca do BigQuery. Quem fala com o
// BigQuery é a sincronização, em segundo plano — por isso a tela responde em
// milissegundos mesmo com a consulta lá custando 11 segundos.

function lerPalestra(linha) {
  return {
    slug: linha.slug,
    cidade: linha.cidade,
    data: linha.data,
    palestrantes: JSON.parse(linha.palestrantes),
    cadastrados: linha.cadastrados,
    presentes: linha.presentes,
    presentesTribo: linha.presentes_tribo,
    presentesAldeia: linha.presentes_aldeia,
    presentesLead: linha.presentes_lead,
    pctPresenca: linha.pct_presenca,
    vendas: linha.vendas,
    vendasTotais: linha.vendas_totais,
    vendasAPagar: linha.vendas_a_pagar,
    canceladas: linha.canceladas,
    conversao: linha.conversao,
  };
}

// O campo Palestrante de info_leads é o principal: quando vem preenchido, é a
// lista de quem fica com aquele lead (pode ser mais de um nome). Vazio, cai no
// fallback de sempre — quem subiu ao palco naquela palestra, segundo a base de
// métricas. Nos dois casos pode ser mais de uma pessoa, e quando for, o lead é
// dos dois juntos — não existe "de quem exatamente" nesse caso.
const donosDo = (palestrantesDoLead, palestrantesDoEvento) => (
  palestrantesDoLead?.length ? palestrantesDoLead : palestrantesDoEvento
);

async function leadsDa(db, palestra, usuario) {
  const meus = usuario && usuario.papel !== 'admin' ? new Set(usuario.vinculos ?? []) : null;
  const { rows } = await db.execute({
    sql: 'SELECT nome, telefone, email, etapa, palestrantes, checkin_em, closer FROM leads WHERE palestra_slug = ?',
    args: [palestra.slug],
  });
  return rows
    .map((l) => ({
      nome: l.nome,
      telefone: l.telefone ?? '',
      email: l.email ?? '',
      etapaName: l.etapa,
      // checkin_em ainda é sempre null — ver o comentário em server/data/db.js.
      checkinEm: l.checkin_em ?? null,
      closer: l.closer ?? null,
      donos: donosDo(l.palestrantes ? JSON.parse(l.palestrantes) : null, palestra.palestrantes),
    }))
    .filter((l) => !meus || l.donos.some((n) => meus.has(n)));
}

// O recorte por instrutor acontece aqui, antes de qualquer coisa virar JSON. Se
// vivesse no frontend, os dados dos colegas viajariam no payload.
function visivel(palestra, usuario) {
  if (!usuario || usuario.papel === 'admin') return true;
  const meus = new Set(usuario.vinculos ?? []);
  return palestra.palestrantes.some((n) => meus.has(n));
}

function porInstrutor(palestra, leads) {
  return palestra.palestrantes.map((nome) => {
    const s = slug(nome);
    // O cliente precisa saber quem tem arquivo para não pedir e tomar 404.
    return { instrutor: nome, slug: s, temFoto: temFoto(s),
      ...resumoEvento(leads.filter((l) => l.donos.includes(nome))) };
  });
}

function resumoDaPalestra(palestra, leads) {
  return { ...palestra, leads: leads.length, instrutores: porInstrutor(palestra, leads) };
}

export async function listarEventos(db, usuario) {
  const { rows } = await db.execute('SELECT * FROM palestras ORDER BY data DESC');
  const visiveis = rows.map(lerPalestra).filter((p) => visivel(p, usuario));
  return Promise.all(visiveis.map(async (p) => resumoDaPalestra(p, await leadsDa(db, p, usuario))));
}

export async function detalheEvento(db, eventoSlug, usuario) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM palestras WHERE slug = ?', args: [eventoSlug] });
  const linha = rows[0];
  if (!linha) return {};
  const palestra = lerPalestra(linha);
  // Para um instrutor que não subiu naquele palco, a palestra simplesmente não
  // existe: mesmo 404 de um slug inventado.
  if (!visivel(palestra, usuario)) return {};
  const leads = await leadsDa(db, palestra, usuario);
  return { ...resumoDaPalestra(palestra, leads), resumo: resumoEvento(leads), colunas: montarColunas(leads) };
}

// Números que a gestão precisa ver para cobrar a origem dos dados.
export async function saude(db) {
  const s = await ultimaSincronizacao(db);
  return {
    descartados: s?.descartados ?? 0,
    semPalestra: s?.sem_palestra ?? 0,
    duplicados: s?.duplicados ?? 0,
    atualizadoEm: s?.em ?? null,
  };
}

// Nomes de palestrante que realmente aparecem nos dados — alimenta a escolha
// guiada do cadastro, para que ninguém digite a grafia errada. Une as duas
// bases porque elas às vezes divergem (docs/dados-que-faltam.md): um nome que
// só apareça no Palestrante de info_leads não pode ficar de fora da lista.
export async function nomesDePalestrante(db) {
  const nomes = new Set();
  const [{ rows: dePalestras }, { rows: deLeads }] = await Promise.all([
    db.execute('SELECT palestrantes FROM palestras'),
    db.execute('SELECT palestrantes FROM leads WHERE palestrantes IS NOT NULL'),
  ]);
  for (const p of dePalestras) {
    for (const n of JSON.parse(p.palestrantes)) nomes.add(n);
  }
  for (const l of deLeads) {
    for (const n of JSON.parse(l.palestrantes)) nomes.add(n);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
