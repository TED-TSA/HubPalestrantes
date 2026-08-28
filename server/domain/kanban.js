import { slug } from './texto.js';
import { config } from '../../config.js';

// A origem escreve a mesma etapa de mais de um jeito — "JÁ É MEMBRO" e "JA É
// MEMBRO" convivem na base. O slug é o que faz as duas caírem na mesma coluna;
// o nome que aparece na tela é o da configuração.
const chave = (nome) => slug(nome);

// Um quadro que só desenha etapa com lead não é um kanban: etapa vazia também é
// informação ("ninguém pagou tribo ainda"). Por isso o funil vem inteiro da
// configuração, e não dos leads que chegaram.
//
// O EtapaId real é um hash (`hnvDvFHpoZk3l3UNhXz9`) e cada funil tem os seus:
// nunca foi possível ordenar o quadro por ele.
export function montarColunas(leads) {
  const colunas = new Map(config.ordemEtapas.map((nome) => [
    chave(nome), { etapaId: null, etapaName: nome, leads: [] },
  ]));
  // Etapa que a configuração não conhece não pode sumir da tela: vira coluna no
  // fim do quadro e é o sinal de que a lista em config.js ficou velha.
  const extras = new Map();

  for (const l of leads) {
    const k = chave(l.etapaName);
    let alvo = colunas.get(k) ?? extras.get(k);
    if (!alvo) {
      alvo = { etapaId: l.etapaId, etapaName: l.etapaName, leads: [] };
      extras.set(k, alvo);
    }
    alvo.etapaId ??= l.etapaId;
    alvo.leads.push(l);
  }

  const fim = [...extras.values()]
    .sort((a, b) => String(a.etapaName).localeCompare(String(b.etapaName), 'pt-BR'));
  return [...colunas.values(), ...fim];
}
