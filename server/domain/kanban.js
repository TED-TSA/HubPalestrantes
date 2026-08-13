import { ordenarEtapas } from './palestra.js';

// O EtapaId real é um hash (`hnvDvFHpoZk3l3UNhXz9`), e cada funil tem os seus:
// não dá para ordenar o quadro por ele. A ordem vem da configuração, por nome.
export function montarColunas(leads) {
  const mapa = new Map();
  for (const l of leads) {
    const key = l.etapaName;
    if (!mapa.has(key)) mapa.set(key, { etapaId: l.etapaId, etapaName: key, leads: [] });
    mapa.get(key).leads.push(l);
  }
  const ordem = ordenarEtapas([...mapa.keys()]);
  return ordem.map((nome) => mapa.get(nome));
}
