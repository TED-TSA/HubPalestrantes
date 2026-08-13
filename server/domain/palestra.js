import { slug } from './texto.js';
import { config } from '../../config.js';

// "Elidiano / Elizier" → ['Elidiano', 'Elizier']. Uma palestra pode ter mais de
// um palestrante no palco, separados por barra.
export function separarPalestrantes(campo) {
  return String(campo ?? '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
}

const numero = (v) => (v === null || v === undefined ? 0 : Number(v));

// Uma linha de presencial_metricas vira uma palestra. A identidade é cidade +
// data: a mesma cidade pode receber duas palestras (Balneário Camboriú teve
// 20/05 e 10/08).
export function montarPalestra(linha) {
  const cidade = String(linha.cidade ?? '').trim();
  const data = String(linha.data_evento ?? '').trim();
  const presentes = numero(linha.checkin_geral);
  const vendas = numero(linha.vendas_efetivas);
  return {
    cidade,
    data,
    slug: `${slug(cidade)}-${data}`,
    palestrantes: separarPalestrantes(linha.palestrante),
    cadastrados: numero(linha.cadastrados),
    presentes,
    presentesTribo: numero(linha.checkin_tribo),
    presentesAldeia: numero(linha.checkin_aldeia),
    presentesLead: numero(linha.checkin_lead),
    // pct_presentes já vem multiplicado por 100 na origem (7.8 = 7,8%).
    pctPresenca: numero(linha.pct_presentes) / 100,
    vendasTotais: numero(linha.vendas_total),
    vendasAPagar: numero(linha.vendas_a_pagar),
    canceladas: numero(linha.cancelados),
    vendas,
    // Vender para quem esteve na sala é a taxa que importa numa palestra.
    conversao: presentes ? vendas / presentes : 0,
  };
}

// O nome do funil vem como "Presencial Ribeirão Preto"; a base de métricas
// guarda só "Ribeirão Preto". É por aqui que as duas se encontram.
export function cidadeDoPipeline(pipelineName) {
  return String(pipelineName ?? '').replace(/^\s*presencial\s+/i, '').trim();
}

// Leads não têm data, então uma cidade com duas palestras não tem como ser
// desempatada. Vão para a mais recente, que é a aposta certa para lead em
// aberto — quem ainda está sendo trabalhado veio do evento que acabou de ocorrer.
export function indexarPalestrasPorCidade(palestras) {
  const porCidade = new Map();
  for (const p of palestras) {
    const chave = slug(p.cidade);
    const atual = porCidade.get(chave);
    if (!atual || p.data > atual.data) porCidade.set(chave, p);
  }
  return porCidade;
}

// EtapaId é hash, não sequência: a ordem do funil vem da configuração. O que
// não estiver na lista cai no fim, em ordem alfabética.
export function ordenarEtapas(nomes) {
  const ordem = config.ordemEtapas.map((e) => e.toUpperCase());
  const posicao = (n) => {
    const i = ordem.indexOf(String(n).toUpperCase());
    return i === -1 ? ordem.length : i;
  };
  return [...nomes].sort((a, b) => posicao(a) - posicao(b) || String(a).localeCompare(String(b), 'pt-BR'));
}
