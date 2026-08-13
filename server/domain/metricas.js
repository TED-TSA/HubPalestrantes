import { parseConexao } from './instrutor.js';
import { slug } from './texto.js';

// O lead traz onde a pessoa está no atendimento. Quem comprou e quanto vendeu
// vem da base da palestra, não daqui: o cruzamento com o Pipedrive por
// telefone/e-mail contava um subconjunto e dava dois números com o mesmo nome.
export function enriquecerLeads(leadsRaw) {
  return (leadsRaw ?? []).map((l) => {
    const { modalidade, instrutor } = parseConexao(l.Conexao);
    // 298 dos 308 leads vêm sem Conexão. Quem tem, ganha dono individual; quem
    // não tem, será atribuído a quem subiu ao palco daquela palestra.
    const instrutorConhecido = !!String(l.Conexao ?? '').trim();
    return {
      instrutorConhecido,
      nome: l.Nome ?? '',
      telefone: l.Telefone ?? '',
      email: l.Email ?? '',
      evento: l.PipelineName ?? '',
      etapaId: l.EtapaId ?? '',
      etapaName: l.EtapaName ?? 'Sem etapa',
      modalidade,
      instrutor,
      instrutorSlug: slug(instrutor),
    };
  });
}

export function resumoEvento(leads) {
  return { total: leads.length };
}
