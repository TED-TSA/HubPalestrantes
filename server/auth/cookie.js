export function lerCookies(header) {
  const saida = {};
  for (const parte of String(header ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    const nome = parte.slice(0, i).trim();
    if (!nome) continue;
    try { saida[nome] = decodeURIComponent(parte.slice(i + 1).trim()); }
    catch { saida[nome] = parte.slice(i + 1).trim(); }
  }
  return saida;
}

export function montarCookie(nome, valor, { maxAge, seguro = false } = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAge !== undefined) partes.push(`Max-Age=${maxAge}`);
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}
