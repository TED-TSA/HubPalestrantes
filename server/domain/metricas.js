import { separarPalestrantes } from './palestra.js';
import { ehVazio } from './texto.js';

// O lead traz onde a pessoa está no atendimento. Quem comprou e quanto vendeu
// vem da base da palestra, não daqui: o cruzamento com o Pipedrive por
// telefone/e-mail contava um subconjunto e dava dois números com o mesmo nome.
export function enriquecerLeads(leadsRaw) {
  return (leadsRaw ?? []).map((l) => ({
    nome: l.Nome ?? '',
    telefone: l.Telefone ?? '',
    email: l.Email ?? '',
    evento: l.PipelineName ?? '',
    // Ainda em upload do lado da origem (docs/dados-que-faltam.md, seção 5) —
    // null aqui é o caso normal de hoje, e cai no fallback por cidade.
    eventName: ehVazio(l.EventName) ? null : l.EventName,
    etapaId: l.EtapaId ?? '',
    etapaName: l.EtapaName ?? 'Sem etapa',
    // `Palestrante` traz o mesmo valor pra todo lead do evento — não é uma
    // atribuição individual, é a lista de quem subiu ao palco segundo essa
    // tabela. Vazio (ou a palavra "null") vira null aqui, e quem decide o
    // fallback pra lista de palco da outra base é server/data/repository.js.
    palestrantes: ehVazio(l.Palestrante) ? null : separarPalestrantes(l.Palestrante),
    // Check-in ainda não tem fonte (docs/dados-que-faltam.md) — o campo só
    // deixa de ser null no dia em que `SQL_LEADS` passar a selecionar
    // `DataCheckin` (nome combinado para a coluna nova em info_leads, ainda
    // não criada). O atendente (closer) já vem de verdade, de `Atendente`.
    checkinEm: ehVazio(l.DataCheckin) ? null : l.DataCheckin,
    closer: ehVazio(l.Atendente) ? null : l.Atendente,
  }));
}

export function resumoEvento(leads) {
  return { total: leads.length };
}

// A origem manda a mesma pessoa mais de uma vez às vezes (até 3x, visto na
// base real) — mesmo nome, telefone, e-mail e etapa, dentro da mesma palestra.
// Conta como um só lead: fica a cópia com check-in mais recente, se alguma
// tiver; sem check-in em nenhuma, tanto faz qual — nunca as duas juntas, senão
// o problema da origem vira "leads a mais" na tela.
//
// `itens` é a lista de [slugPalestra, lead] que a sincronização monta antes de
// gravar — mesma forma de entrada e saída, pra plugar direto ali.
export function deduplicarLeads(itens) {
  const porChave = new Map();
  for (const item of itens) {
    const [slugPalestra, l] = item;
    const chave = [slugPalestra, l.nome, l.telefone, l.email, l.etapaName].join('|');
    const atual = porChave.get(chave);
    const ganhaDoAtual = !atual || (l.checkinEm && (!atual[1].checkinEm || l.checkinEm > atual[1].checkinEm));
    if (ganhaDoAtual) porChave.set(chave, item);
  }
  return [...porChave.values()];
}
