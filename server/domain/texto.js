export function soDigitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export function chaveTelefone(s) {
  const d = soDigitos(s);
  return d.length >= 8 ? d.slice(-8) : '';
}

export function normalizarEmail(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function slug(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
