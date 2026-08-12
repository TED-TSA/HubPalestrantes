import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Parâmetros de custo do scrypt. 128 * N * r ≈ 16 MB de memória por verificação,
// dentro do maxmem padrão do Node.
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

export function gerarHash(senha) {
  const sal = randomBytes(16);
  const chave = scryptSync(senha, sal, TAMANHO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64'), chave.toString('base64')].join('$');
}

export function conferirSenha(senha, hash) {
  try {
    const [alg, n, r, p, sal, chave] = String(hash).split('$');
    if (alg !== 'scrypt') return false;
    const esperado = Buffer.from(chave, 'base64');
    const obtido = scryptSync(String(senha), Buffer.from(sal, 'base64'), esperado.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
  } catch {
    return false;
  }
}

export function senhaAceitavel(senha) {
  return typeof senha === 'string' && senha.length >= 8;
}
