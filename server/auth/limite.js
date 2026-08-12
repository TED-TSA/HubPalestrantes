// Freio simples de força bruta, em memória. Some quando o processo reinicia —
// suficiente para ferramenta interna, não pretende ser antifraude.
const MAX_FALHAS = 5;
const JANELA_MS = 5 * 60 * 1000;

const tentativas = new Map();

export function bloqueado(chave, agora = Date.now()) {
  const t = tentativas.get(chave);
  if (!t) return false;
  if (agora - t.desde > JANELA_MS) { tentativas.delete(chave); return false; }
  return t.falhas >= MAX_FALHAS;
}

export function registrarFalha(chave, agora = Date.now()) {
  const t = tentativas.get(chave);
  if (!t || agora - t.desde > JANELA_MS) tentativas.set(chave, { falhas: 1, desde: agora });
  else t.falhas += 1;
}

export function limparFalhas(chave) {
  tentativas.delete(chave);
}

export function zerarTudo() {
  tentativas.clear();
}
