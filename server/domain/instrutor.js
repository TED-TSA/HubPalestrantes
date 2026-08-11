export function parseConexao(conexao) {
  const s = String(conexao ?? '').trim();
  if (!s) return { modalidade: '', instrutor: 'Não identificado' };
  const i = s.indexOf(' ');
  if (i === -1) return { modalidade: '', instrutor: s };
  return { modalidade: s.slice(0, i), instrutor: s.slice(i + 1).trim() };
}
