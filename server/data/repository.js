import { resumoEvento } from '../domain/metricas.js';
import { montarColunas } from '../domain/kanban.js';
import { ultimaSincronizacao } from './sincronizacao.js';
import { slug } from '../domain/texto.js';

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

// Um lead sem Conexão não tem dono individual: pertence a quem subiu ao palco
// naquela palestra. É a única atribuição possível, já que a esmagadora maioria
// vem sem esse campo.
const donosDo = (lead, palestrantes) => (lead.instrutor ? [lead.instrutor] : palestrantes);

function leadsDa(db, palestra, usuario) {
  const meus = usuario && usuario.papel !== 'admin' ? new Set(usuario.vinculos ?? []) : null;
  return db.prepare('SELECT nome, telefone, email, etapa, instrutor FROM leads WHERE palestra_slug = ?')
    .all(palestra.slug)
    .map((l) => ({
      nome: l.nome,
      telefone: l.telefone ?? '',
      email: l.email ?? '',
      etapaName: l.etapa,
      instrutor: l.instrutor ?? '',
      instrutorConhecido: !!l.instrutor,
      instrutorSlug: l.instrutor ? slug(l.instrutor) : '',
      donos: donosDo(l, palestra.palestrantes),
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
  return palestra.palestrantes.map((nome) => ({
    instrutor: nome,
    slug: slug(nome),
    ...resumoEvento(leads.filter((l) => l.donos.includes(nome))),
  }));
}

function resumoDaPalestra(palestra, leads) {
  return { ...palestra, leads: leads.length, instrutores: porInstrutor(palestra, leads) };
}

export function listarEventos(db, usuario) {
  return db.prepare('SELECT * FROM palestras ORDER BY data DESC').all()
    .map(lerPalestra)
    .filter((p) => visivel(p, usuario))
    .map((p) => resumoDaPalestra(p, leadsDa(db, p, usuario)));
}

export function detalheEvento(db, eventoSlug, usuario) {
  const linha = db.prepare('SELECT * FROM palestras WHERE slug = ?').get(eventoSlug);
  if (!linha) return {};
  const palestra = lerPalestra(linha);
  // Para um instrutor que não subiu naquele palco, a palestra simplesmente não
  // existe: mesmo 404 de um slug inventado.
  if (!visivel(palestra, usuario)) return {};
  const leads = leadsDa(db, palestra, usuario);
  return { ...resumoDaPalestra(palestra, leads), resumo: resumoEvento(leads), colunas: montarColunas(leads) };
}

// Números que a gestão precisa ver para cobrar a origem dos dados.
export function saude(db) {
  const s = ultimaSincronizacao(db);
  return {
    descartados: s?.descartados ?? 0,
    semPalestra: s?.sem_palestra ?? 0,
    atualizadoEm: s?.em ?? null,
  };
}

// Nomes de palestrante que realmente aparecem nos dados — alimenta a escolha
// guiada do cadastro, para que ninguém digite a grafia errada.
export function nomesDeConexao(db) {
  const nomes = new Set();
  for (const p of db.prepare('SELECT palestrantes FROM palestras').all()) {
    for (const n of JSON.parse(p.palestrantes)) nomes.add(n);
  }
  for (const l of db.prepare('SELECT DISTINCT instrutor FROM leads WHERE instrutor IS NOT NULL').all()) {
    nomes.add(l.instrutor);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
