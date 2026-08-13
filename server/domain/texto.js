export function slug(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// O pipeline que alimenta info_leads grava ausência como a PALAVRA "null", não
// como NULL de banco. Sem isto, `if (valor)` deixa passar tudo.
export function ehVazio(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '' || s === 'null';
}
