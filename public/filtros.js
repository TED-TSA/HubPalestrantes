// Filtro da home. Módulo puro de propósito: a tela entrega a lista de eventos e
// o que a pessoa escolheu, e nada aqui toca no DOM — por isso tem teste.
//
// A home já recebe todos os eventos num payload só (o recorte por instrutor
// acontece no servidor, antes de virar JSON), então filtrar é trabalho de
// cliente: não custa uma ida ao servidor por clique.
import { rotuloPeriodo } from './datas.js';

export const SEM_FILTRO = { periodo: '', cidade: '', palestrante: '' };

// O período aceita mês ("2026-08") ou ano inteiro ("2026"): nos dois casos é o
// prefixo da data ISO, então uma comparação resolve as duas formas.
const casaPeriodo = (ev, periodo) => !periodo || String(ev.data ?? '').startsWith(periodo);
const casaCidade = (ev, cidade) => !cidade || ev.cidade === cidade;
const casaPalestrante = (ev, palestrante) => !palestrante
  || (ev.instrutores ?? []).some((i) => i.slug === palestrante);

export function filtrarEventos(eventos, filtro = SEM_FILTRO) {
  const { periodo, cidade, palestrante } = { ...SEM_FILTRO, ...filtro };
  return (eventos ?? []).filter((ev) => casaPeriodo(ev, periodo)
    && casaCidade(ev, cidade)
    && casaPalestrante(ev, palestrante));
}

const emOrdem = (nomes) => [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const porRotulo = (a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR');

// As opções saem dos eventos que a pessoa tem na mão, nunca de uma lista fixa:
// assim o instrutor não vê no filtro uma cidade em que não subiu ao palco, e
// nenhuma escolha devolve tela vazia.
export function opcoesDeFiltro(eventos) {
  const periodos = new Set();
  const cidades = new Set();
  const palestrantes = new Map();

  for (const ev of eventos ?? []) {
    const mes = String(ev.data ?? '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(mes)) periodos.add(mes);
    if (ev.cidade) cidades.add(ev.cidade);
    for (const i of ev.instrutores ?? []) {
      if (i.slug && !palestrantes.has(i.slug)) palestrantes.set(i.slug, i.instrutor);
    }
  }

  return {
    // Do mais recente para o mais antigo, como a grade de eventos.
    periodos: [...periodos].sort().reverse().map((valor) => ({ valor, rotulo: rotuloPeriodo(valor) })),
    cidades: emOrdem(cidades),
    // O valor é o slug, não o nome: é ele que o servidor usa para identificar
    // instrutor, e dois homônimos não colidiriam no filtro.
    palestrantes: [...palestrantes].map(([valor, rotulo]) => ({ valor, rotulo })).sort(porRotulo),
  };
}
