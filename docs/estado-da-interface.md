# Hub do Palestrante — estado atual da interface

Documento para o time de design. O desenho entregue anteriormente **foi
implementado** e evoluiu depois disso. Isto descreve o que está de pé hoje, o que
mudou em relação ao entregue, e onde ainda está fraco.

Substitui o briefing anterior (`briefing-interface.md`), que descrevia a
interface antes do redesign.

---

## 1. O que aconteceu com o desenho entregue

O arquivo veio como bundle React puxando React 18 do unpkg por CDN. **Não era
utilizável**: o projeto não tem etapa de build e precisa funcionar sem internet
externa. Em vez de recriar no olho, o bundle foi descompactado, o markup com os
estilos inline foi extraído, e tudo foi portado para CSS puro **com os valores
originais** — 42px na sigla do evento, `.22em` de espaçamento nos rótulos,
`#63616c` nas legendas.

Resultado: o desenho está no ar quase ao pé da letra. As diferenças estão na
seção 6.

**Para a próxima entrega, por favor entregue como HTML + CSS estáticos**, ou como
descrição visual com valores. Um bundle React custa um trabalho de tradução que
não precisa existir.

---

## 2. Amarras técnicas (inalteradas, e ainda eliminatórias)

- **Sem etapa de build.** Nada de bundler, JSX, TypeScript ou pré-processador de
  CSS. São arquivos servidos direto por um Express.
- **Sem CDN e sem rede externa.** Nada de Google Fonts, Tailwind por CDN,
  biblioteca de ícones. Ícones são **SVG inline**; fontes são **do sistema**.
- **Sem framework.** A tela é montada com template strings e `innerHTML`.
- **Público em Windows + Chrome**, e precisa ser usável no celular.

Tamanho do frontend inteiro hoje: **1.481 linhas** (`app.js` 594, `styles.css`
684, o resto HTML). É pequeno de propósito.

---

## 3. O produto, em um parágrafo

Palestrantes da TradeStars sobem ao palco, coletam contatos (leads) e depois
ligam para essas pessoas. Quem não é atendido vai para os vendedores. O Hub
existe para o instrutor abrir no dia seguinte e responder: *quem eu ainda não
liguei, quem já respondeu, quem comprou.* Somente leitura sobre dados do
BigQuery, com cadastro próprio de usuários por cima.

Dois perfis: **instrutor** (vê só os eventos e leads dele) e **gestão** (vê
tudo). O recorte acontece no servidor — lead de terceiro não trafega no payload,
então a tela do instrutor nunca pode ter um botão "ver todos".

---

## 4. Sistema visual

### 4.1 Dois temas

O escuro é o padrão e a identidade. O claro entrou depois, com botão no topo. O
tema fica em `data-tema` no `<html>`, resolvido por um script inline no `<head>`
que lê a escolha salva ou cai na preferência do sistema.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#08080a` | `#f2efe9` | fundo da página |
| `--surface` | `#131317` | `#ffffff` | cards, colunas |
| `--surface-alta` | `#1b1b21` | `#f7f5f0` | cards de lead |
| `--borda` | `#26262f` | `#e0dbd1` | divisórias |
| `--borda-viva` | `#3a3a46` | `#c4bdb0` | bordas em hover |
| `--texto` | `#f4f2ee` | `#14130f` | texto |
| `--suave` | `#8b8894` | `#56534c` | secundário |
| `--fraco` | `#63616c` | `#7a766d` | rótulos |
| `--apagado` | `#4b4956` | `#837e73` | estados vazios |
| `--acento` | `#e8b44a` | `#96660a` | âmbar de **texto e traço** |
| `--acento-solido` | `#e8b44a` | `#e8b44a` | âmbar de **preenchimento** |
| `--venda` | `#3fd69b` | `#0a7a52` | verde, só para "vendeu" |

Três coisas que a inversão de paleta exigiu, e que valem para qualquer proposta
nova:

1. **O âmbar tem dois papéis.** `#e8b44a` sobre branco fica em 1,8:1 — ilegível
   como texto. O de texto e traço escurece no tema claro; o vivo permanece nos
   preenchimentos, que levam texto escuro por cima.
2. **Os véus sobre foto invertem.** No escuro eles escurecem para o texto claro
   aparecer; no claro precisam clarear, senão o nome do evento fica preto sobre
   foto preta.
3. **O painel do vídeo no login é sempre escuro**, tema claro ou não. O texto por
   cima dele fica fixado em claro nos dois.

### 4.2 Tipografia e estrutura

- **Display:** `Bahnschrift` (a DIN condensada do Windows), fallbacks
  `DIN Alternate`, `Segoe UI Variable Display`. Carrega toda a estrutura —
  títulos, rótulos, números — em caixa alta com espaçamento largo.
- **Corpo:** `Segoe UI Variable Text`. Fica só nos nomes próprios e textos
  corridos.
- **Mono:** `Cascadia Mono` / `Consolas` para telefone e e-mail — são dados de
  conferir dígito a dígito, não texto de ler.
- **Nada tem canto arredondado.** Nenhum `border-radius` em card, coluna, botão
  ou campo. As únicas exceções são o ponto verde de venda e o toggle.

### 4.3 O corte diagonal

É o gesto que dá identidade às fotos. A foto entra pela direita do card e é
cortada por uma aresta inclinada, marcada por um fio âmbar de 1px.

- A inclinação é **30%** da largura da área de foto (era 46%, foi suavizada para
  mostrar mais rosto).
- Com mais de um instrutor, a área é dividida em **faixas paralelas**, uma por
  pessoa, separadas pelo mesmo fio.
- Teto de **três faixas** no card de evento: na quarta a largura cai para uns
  30px e não dá para reconhecer ninguém. O excedente vira "+N".
- Cada foto é centrada **no meio da faixa na altura do rosto** (~28% do topo),
  não no meio da caixa. A faixa é inclinada: no meio da caixa o rosto encosta na
  aresta e sai cortado.
- O fio âmbar **não pode ser um `drop-shadow`** — `clip-path` recorta o resultado
  do `filter` e apaga a sombra. É uma cópia da forma, em âmbar, 2px atrás.

**As fotos são a única coisa colorida da interface.** Exceção proposital: é rosto
de pessoa, não dado.

---

## 5. As telas hoje

### 5.1 Login

Card central de 1000px partido ao meio, no padrão do sistema financeiro da casa.

- **Esquerda:** vídeo em loop, preto e branco, mudo, 720×1280, 5,7 MB. É uma
  montagem com 5 a 6 segundos de cada um dos cinco palestrantes (Luiz Hota,
  Elidiano, Siqueira, Bam, Tonho). Por cima: selo TS, "HUB DO PALESTRANTE" em
  display, três itens numerados com filete, e o rodapé.
- **Direita:** "Bem-vindo de volta", campos com ícone SVG, olho de mostrar senha,
  "Manter conectado" e o botão âmbar sólido "Acessar o Hub →".
- O vídeo só baixa em tela grande, fora de economia de dados e sem preferência
  por menos movimento. Nos outros casos fica o frame estático.
- Erro **sempre genérico** ("Email ou senha inválidos"). Não mudar: revelaria
  quem trabalha na empresa.

### 5.2 Home — grade de eventos

Cabeçalho de seção com rótulo, contagem e um fio ocupando o resto da linha.
Cards de 300px mínimo:

- Nome partido em **sigla + número** (`CXJ` pesado, `3006` apagado).
- **Foto dos instrutores cortada na diagonal**, ocupando 82% do card.
- Três métricas no rodapé: leads, vendas, conversão — separadas por fios.
- **Barra de conversão** de 2px na base do card, proporcional ao percentual.

### 5.3 Evento

- Cabeçalho com sigla + número grandes e as três métricas à direita.
- **Instrutor vendo o próprio evento:** uma barra horizontal com foto, nome e
  "SEU RECORTE DESTE EVENTO", métricas à direita. (Isto resolveu uma fraqueza
  apontada no briefing anterior — antes era um card solitário que parecia sobra
  de um layout feito para vários.)
- **Gestão:** grade "Instrutores no palco", cada card com o mesmo corte diagonal,
  nome em display e leads/vendas no pé. Clicar filtra o quadro.
- **Kanban:** colunas geradas pelos dados (as `EtapaName` que existirem, na ordem
  do funil), numeradas `01/02/03`, com contagem à direita e um filete de 2px
  abaixo do cabeçalho. Cards de lead com nome, telefone e e-mail mascarados em
  mono, e — quando houve venda — um filete, ponto verde e o nome do curso.
- Legenda "● VENDEU" na linha do título do quadro.

### 5.4 Cadastro de instrutores (só gestão)

Aviso de nomes órfãos no topo, formulário de novo instrutor e tabela dos
cadastrados. O conceito central é o **vínculo**: o nome do instrutor não é
digitado, é escolhido entre os que realmente aparecem nos dados.

### 5.5 Estados

- **Vazio:** título em display caixa alta e um parágrafo dizendo o que fazer
  ("...fale com o time de BI"). Não é um traço nem um "sem dados".
- **Carregando:** esqueleto de cards pulsando, não um texto "Carregando…".

---

## 6. Onde a implementação se afastou do desenho entregue

Todas com motivo, mas abertas a discussão:

| Desenho | Implementado | Por quê |
|---|---|---|
| Checkbox azul do sistema | Checkbox âmbar | Azul brigava com a paleta |
| "Acessar Painel" | "Acessar o Hub" | É este produto, não o financeiro |
| "GALA 2025" no rodapé | "Nossos palestrantes" | O vídeo deixou de ser da gala |
| Valores em R$ nos cards | Removidos | Decisão de produto |
| Corte diagonal a 46% | 30% | Mostrava pouca foto |
| Fotos em P&B | **Coloridas** | Pedido do cliente |

Também **não foi implementada** a versão de celular do kanban que troca colunas
por chips de etapa. Hoje as colunas viram uma pilha vertical: funciona, mas é
longa de rolar.

---

## 7. Onde ainda está fraco

Honestamente, para não gastarem tempo redescobrindo:

- **A tela não guia ação nenhuma.** O instrutor abre e vê um retrato do passado.
  O que ele quer é "ligue para estes 4 hoje". Continua sendo a maior
  oportunidade do produto, e nada no desenho atual endereça isso.
- **O quadro não mostra tempo.** Um lead parado há duas semanas em "Novo" parece
  igual a um que entrou ontem. Os dados de data existem no BigQuery.
- **O card de evento não tem data nem local.** Só sigla, número e três métricas.
- **Dois campos existem na API e ninguém usa:** `modalidade` (Presencial/Online)
  e `vendedor` (quem fechou a venda). São matéria-prima disponível.
- **O kanban no celular** (item acima).
- **O botão de tema só existe no app**, não na tela de login. Quem entra pela
  primeira vez pega a preferência do sistema e não tem como mudar antes de logar.

---

## 8. Aviso sobre os dados

A tabela de leads do BigQuery está **vazia**. Os dados reais ainda não caíram.
Toda a interface precisa ficar decente com zero linha — os estados vazios
importam tanto quanto as telas cheias.

Consequência prática: os nomes de evento (`CXJ 3006`, `SP 4010`) e de etapa
(`Novo`, `Em contato`, `Convertido`, `Não atendeu`) que aparecem hoje são de um
conjunto de exemplo. Os reais podem ter comprimentos bem diferentes.

**Dos cinco palestrantes que aparecem no vídeo do login, dois ainda não têm foto
nem cadastro:** Luiz Hota e Tonho. Eles caem no avatar de iniciais.

---

## 9. Para rodar e ver

```bash
USAR_EXEMPLO=1 npm start   # dados de exemplo, dois eventos
npm start                  # dados reais (hoje, tela vazia)
```

Abre em `http://localhost:3000`. Sem sessão, redireciona para `/login`.
