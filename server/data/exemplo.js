// Espelha o formato real: PipelineName é "Presencial <Cidade>", Conexão quase
// sempre ausente, e etapas com os nomes que o funil usa de verdade.
export const palestrasExemplo = [
  {
    cidade: 'Sorocaba', palestrante: 'Elizier', data_evento: '2026-08-10',
    cadastrados: 1153, checkin_geral: 90, checkin_tribo: 12, checkin_aldeia: 8, checkin_lead: 70,
    pct_presentes: 7.8, vendas_total: 9, vendas_a_pagar: 0, cancelados: 0, vendas_efetivas: 9,
  },
  {
    cidade: 'Ribeirão Preto', palestrante: 'Elidiano / Elizier', data_evento: '2026-07-29',
    cadastrados: 950, checkin_geral: 72, checkin_tribo: 9, checkin_aldeia: 5, checkin_lead: 58,
    pct_presentes: 7.6, vendas_total: 10, vendas_a_pagar: 2, cancelados: 2, vendas_efetivas: 8,
  },
  {
    cidade: 'Uberlândia', palestrante: 'Elidiano', data_evento: '2026-07-27',
    cadastrados: 1327, checkin_geral: 174, checkin_tribo: 20, checkin_aldeia: 14, checkin_lead: 140,
    pct_presentes: 13.1, vendas_total: 22, vendas_a_pagar: 2, cancelados: 0, vendas_efetivas: 20,
  },
];

export const leadsExemplo = [
  // Sorocaba — dois leads com Conexão, o resto sem dono individual.
  { Nome: 'Hérika Rodrigues', Email: 'herika@ex.com', Telefone: '5549998033100', PipelineId: '1', PipelineName: 'Presencial Sorocaba', EtapaId: 'W53MqnsBs6a8Rp7gqOGv', EtapaName: 'EM CONTATO', Conexao: 'Presencial Elizier' },
  { Nome: 'Marcos Silva', Email: 'marcos@ex.com', Telefone: '5511990000001', PipelineId: '1', PipelineName: 'Presencial Sorocaba', EtapaId: 'W53MqnsBs6a8Rp7gqOGv', EtapaName: 'EM CONTATO', Conexao: null },
  { Nome: 'Paula Souza', Email: 'paula@ex.com', Telefone: '5511990000002', PipelineId: '1', PipelineName: 'Presencial Sorocaba', EtapaId: 'U5v2etfZbC5SfOFlzE8U', EtapaName: 'JÁ É ALDEIA', Conexao: null },
  { Nome: 'João Pedro', Email: 'joaop@ex.com', Telefone: '5511990000003', PipelineId: '1', PipelineName: 'Presencial Sorocaba', EtapaId: 'NFbZNNzRcL0TH1cClBlH', EtapaName: 'PAGO TRIBO', Conexao: 'Presencial Elizier' },
  { Nome: 'Ana Clara', Email: 'anaclara@ex.com', Telefone: '5511990000004', PipelineId: '1', PipelineName: 'Presencial Sorocaba', EtapaId: 'z1v2IkJziFTgaUX8XF4Z', EtapaName: 'SEM INTERESSE', Conexao: null },

  // Ribeirão Preto — dois palestrantes no palco, nenhum lead com Conexão.
  { Nome: 'Rafael Dias', Email: 'rafael@ex.com', Telefone: '5511990000005', PipelineId: '2', PipelineName: 'Presencial Ribeirão Preto', EtapaId: 'YWgMzTZl40jaT1baioL5', EtapaName: 'EM CONTATO', Conexao: null },
  { Nome: 'Bruna Reis', Email: 'bruna@ex.com', Telefone: '5511990000006', PipelineId: '2', PipelineName: 'Presencial Ribeirão Preto', EtapaId: 'YWgMzTZl40jaT1baioL5', EtapaName: 'EM CONTATO', Conexao: null },
  { Nome: 'Carlos Nunes', Email: 'carlos@ex.com', Telefone: '5521990000010', PipelineId: '2', PipelineName: 'Presencial Ribeirão Preto', EtapaId: 'DEUGuZdDtRpsySOpSPpd', EtapaName: 'MENTORIA', Conexao: null },
  { Nome: 'Fernanda Lima', Email: 'fernanda@ex.com', Telefone: '5521990000011', PipelineId: '2', PipelineName: 'Presencial Ribeirão Preto', EtapaId: 'a9I0bGM0EAPNPdbGYylO', EtapaName: 'JÁ É ALDEIA', Conexao: null },

  // Uberlândia
  { Nome: 'Lucas Gomes', Email: 'lucas@ex.com', Telefone: '5521990000012', PipelineId: '3', PipelineName: 'Presencial Uberlândia', EtapaId: 'HAGRgtPULdixanPx2VRs', EtapaName: 'EM CONTATO', Conexao: null },
  { Nome: 'Patrícia Alves', Email: 'patricia@ex.com', Telefone: '5521990000013', PipelineId: '3', PipelineName: 'Presencial Uberlândia', EtapaId: 'HAGRgtPULdixanPx2VRs', EtapaName: 'EM CONTATO', Conexao: null },
  { Nome: 'Roberto Farias', Email: 'roberto@ex.com', Telefone: '5521990000014', PipelineId: '3', PipelineName: 'Presencial Uberlândia', EtapaId: '91K3CxoUm290DYdqGYHU', EtapaName: 'JÁ É MEMBRO', Conexao: null },
];

