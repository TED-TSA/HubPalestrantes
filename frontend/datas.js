// Texto de data da interface. Vive fora do app.js porque o filtro da home usa o
// mesmo vocabulário de mês, e porque dá para testar sem navegador.

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-08-10" → "10 ago 2026". Montado na mão porque `new Date` interpretaria a
// data como UTC e mostraria o dia anterior no fuso do Brasil.
export function dataCurta(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
}

// "2026-08" → "ago 2026", o rótulo do filtro de período.
export function rotuloPeriodo(periodo) {
  const m = String(periodo ?? '').match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
}
