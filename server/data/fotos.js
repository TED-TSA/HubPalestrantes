import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'public', 'instrutores',
);
const VALIDADE_MS = 30_000;

let conhecidas = null;
let lidoEm = 0;

// Sem isto, o navegador pede a foto de quem não tem arquivo, toma 404 e só então
// troca pelas iniciais — e repete a cada volta para a home. Cinco dos sete
// palestrantes estão nessa situação hoje.
function listar() {
  const agora = Date.now();
  if (conhecidas && agora - lidoEm < VALIDADE_MS) return conhecidas;
  try {
    conhecidas = new Set(
      readdirSync(PASTA)
        .filter((f) => f.toLowerCase().endsWith('.jpg'))
        .map((f) => f.slice(0, -4)),
    );
  } catch {
    conhecidas = new Set();
  }
  lidoEm = agora;
  return conhecidas;
}

export const temFoto = (slug) => listar().has(slug);
