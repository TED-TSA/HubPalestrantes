// Sem isto, o navegador pede a foto de quem não tem arquivo, toma 404 e só então
// troca pelas iniciais — e repete a cada volta para a home. Cinco dos sete
// palestrantes estão nessa situação hoje.
//
// Antes isto lia `frontend/public/instrutores` com `readdirSync` a cada troca
// de tela (com cache de 30s). Na Vercel isso não é confiável: os arquivos em
// `public/` são servidos direto pelo CDN deles, não pela função — o processo
// do servidor não tem garantia de enxergar essa pasta em runtime. Por isso
// virou uma lista mantida à mão (ver public/instrutores/README.md).
const NOMES_COM_FOTO = new Set([
  'bam',
  'elidiano',
  'jacsson-santos',
  'joao-gomes',
  'luiz-hota',
  'pipo',
  'siqueira',
]);

export const temFoto = (slug) => NOMES_COM_FOTO.has(slug);
