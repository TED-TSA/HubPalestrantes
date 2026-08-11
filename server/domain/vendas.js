import { chaveTelefone, normalizarEmail } from './texto.js';

export function indexarVendas(rows) {
  const porTelefone = new Map();
  const porEmail = new Map();
  for (const v of rows ?? []) {
    const kt = chaveTelefone(v.person_phone);
    const ke = normalizarEmail(v.person_email);
    if (kt && !porTelefone.has(kt)) porTelefone.set(kt, v);
    if (ke && !porEmail.has(ke)) porEmail.set(ke, v);
  }
  return { porTelefone, porEmail };
}

export function cruzarLead(lead, index) {
  const kt = chaveTelefone(lead.Telefone);
  const ke = normalizarEmail(lead.Email);
  return (kt && index.porTelefone.get(kt)) || (ke && index.porEmail.get(ke)) || null;
}
