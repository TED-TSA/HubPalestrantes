import { parseConexao } from './instrutor.js';
import { slug } from './texto.js';
import { cruzarLead } from './vendas.js';

export function enriquecerLeads(leadsRaw, vendasIndex) {
  return (leadsRaw ?? []).map((l) => {
    const { modalidade, instrutor } = parseConexao(l.Conexao);
    const venda = cruzarLead(l, vendasIndex);
    return {
      nome: l.Nome ?? '',
      telefone: l.Telefone ?? '',
      email: l.Email ?? '',
      evento: l.PipelineName ?? 'Sem evento',
      etapaId: l.EtapaId ?? '',
      etapaName: l.EtapaName ?? 'Sem etapa',
      modalidade,
      instrutor,
      instrutorSlug: slug(instrutor),
      vendeu: !!venda,
      curso: venda?.curso_comprado ?? null,
      valorPago: venda ? Number(venda.valor_pago ?? 0) || 0 : 0,
      dataVenda: venda?.data_venda ?? null,
      vendedor: venda?.Equipe ?? null,
    };
  });
}

export function resumoEvento(leads) {
  const total = leads.length;
  const vendas = leads.filter((l) => l.vendeu).length;
  const valorTotal = leads.reduce((s, l) => s + (l.valorPago || 0), 0);
  const ids = leads.map((l) => Number(l.etapaId)).filter((n) => !Number.isNaN(n));
  const primeira = ids.length ? Math.min(...ids) : null;
  const atendidos = primeira == null ? 0
    : leads.filter((l) => Number(l.etapaId) !== primeira).length;
  return {
    total, vendas, valorTotal, atendidos,
    pctAtendido: total ? atendidos / total : 0,
    taxaConversao: total ? vendas / total : 0,
  };
}

export function resumoInstrutores(leads) {
  const grupos = new Map();
  for (const l of leads) {
    if (!grupos.has(l.instrutor)) grupos.set(l.instrutor, []);
    grupos.get(l.instrutor).push(l);
  }
  return [...grupos.entries()]
    .map(([instrutor, ls]) => ({ instrutor, slug: ls[0].instrutorSlug, ...resumoEvento(ls) }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}
