export function montarColunas(leads) {
  const mapa = new Map();
  for (const l of leads) {
    const key = l.etapaName;
    if (!mapa.has(key)) mapa.set(key, { etapaId: l.etapaId, etapaName: key, leads: [] });
    mapa.get(key).leads.push(l);
  }
  return [...mapa.values()].sort((a, b) => {
    const na = Number(a.etapaId), nb = Number(b.etapaId);
    const aNum = a.etapaId !== '' && !Number.isNaN(na);
    const bNum = b.etapaId !== '' && !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.etapaName.localeCompare(b.etapaName);
  });
}
