import { parseConexao } from './instrutor.js';
import { slug } from './texto.js';
import { cruzarLead } from './vendas.js';

export function enriquecerLeads(leadsRaw, vendasIndex) {
  return (leadsRaw ?? []).map((l) => {
    const { modalidade, instrutor } = parseConexao(l.Conexao);
    const venda = cruzarLead(l, vendasIndex);
    // 298 dos 308 leads vêm sem Conexão. Quem tem, ganha dono individual; quem
    // não tem, será atribuído a quem subiu ao palco daquela palestra.
    const instrutorConhecido = !!String(l.Conexao ?? '').trim();
    return {
      instrutorConhecido,
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

// "Atendidos" saiu daqui: dependia de EtapaId ser uma sequência numérica, e no
// dado real ele é um hash por funil. A presença de verdade vem da base de
// métricas da palestra, que conta quem apareceu na sala.
export function resumoEvento(leads) {
  const total = leads.length;
  const vendas = leads.filter((l) => l.vendeu).length;
  const valorTotal = leads.reduce((s, l) => s + (l.valorPago || 0), 0);
  return {
    total, vendas, valorTotal,
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
