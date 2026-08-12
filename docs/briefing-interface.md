# Hub do Palestrante — briefing de interface

Documento para quem for redesenhar a interface. Descreve o que o produto é, quem
usa, o que existe em cada tela e — importante — as amarras técnicas, que são
incomuns e derrubam boa parte das soluções de prateleira.

---

## 1. O produto em um parágrafo

A TradeStars tem **palestrantes** (chamados internamente de instrutores) que sobem
ao palco em eventos e vendem cursos durante a palestra. Em cada evento eles coletam
os contatos dos participantes (leads) e depois **ligam para essas pessoas**. Quem o
instrutor não consegue falar é repassado para os vendedores. O Hub existe para o
instrutor abrir no dia seguinte à palestra e responder três perguntas: *quem eu
ainda não liguei, quem já respondeu, e quem comprou.*

Não é um CRM e não edita nada. É **somente leitura** sobre dados que vêm do
BigQuery, com um cadastro próprio de usuários por cima.

---

## 2. Quem usa

| Perfil | Quem é | O que enxerga |
|---|---|---|
| **Instrutor** | Os 6 palestrantes | Só os eventos onde **ele** tem lead, e dentro do evento só os leads dele. Não vê números dos colegas. |
| **Gestão (admin)** | Time de BI/gestão | Todos os eventos, todos os instrutores, e a tela de cadastro. |

O recorte por instrutor acontece no servidor: lead de terceiro **não trafega** no
payload. Isso não é detalhe de implementação — significa que a interface do
instrutor nunca pode ter um botão "ver todos", porque o dado não está lá.

**São 6 instrutores reais:** Bam, Elidiano, Jaccson, João Gomes, Pipo e Siqueira.
Todos têm foto (retrato profissional, fundo escuro). É um público pequeno e
conhecido — não é um SaaS com mil usuários anônimos.

---

## 3. Amarras técnicas (leia antes de desenhar)

Estas são rígidas. Propostas que dependam delas serão descartadas.

- **Sem etapa de build.** Não há npm build, bundler, JSX, TypeScript ou
  pré-processador de CSS. São arquivos servidos direto por um Express: um
  `index.html`, um `styles.css`, um `app.js` (ES module nativo).
- **Sem CDN e sem rede externa.** Nada de Google Fonts, Tailwind por CDN, Font
  Awesome, biblioteca de ícones. Precisa funcionar numa máquina sem internet
  aberta. Ícones são **SVG inline**; fontes são **fontes do sistema**.
- **Sem framework.** Sem React, Vue, Svelte. A tela é montada com template
  strings e `innerHTML`. Se a proposta exigir componentes, ela não é
  implementável aqui sem reescrever o projeto.
- **Público em Windows + Chrome**, mas precisa ser usável no celular — o
  instrutor confere entre uma ligação e outra.
- Tamanho atual do frontend inteiro: **~1.130 linhas** (`app.js` 456,
  `styles.css` 505, resto HTML). É pequeno de propósito.

---

## 4. Identidade visual atual e por quê

Vale entender antes de mudar — algumas escolhas resolvem problemas concretos.

**Dois temas, escuro por padrão.** O claro entrou depois e é a alternativa: o
desenho nasce no escuro. O tema fica em `data-tema` no `<html>`, resolvido por um
script inline no `<head>`.

**Paleta:**

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0b0b0d` | fundo da página |
| `--surface` | `#131317` | cards, colunas do kanban |
| `--surface-alta` | `#1b1b21` | cards de lead (flutuam sobre a coluna) |
| `--borda` | `#26262f` | divisórias |
| `--borda-viva` | `#3a3a46` | bordas em hover |
| `--texto` | `#f4f2ee` | texto (off-white levemente quente) |
| `--suave` | `#8b8894` | texto secundário |
| `--acento` | `#e8b44a` | âmbar; destaque, ações, marca |
| `--venda` | `#3fd69b` | verde; **só** para "vendeu" |

**O acento é âmbar e não verde por um motivo funcional:** o verde já é o
significado de "este lead comprou". Se o acento fosse verde, destaque e venda
ficariam visualmente iguais. A metáfora que guiou o resto é **auditório**: casa
escura, palco aceso, luz de refletor quente — o mundo de quem sobe no palco.

**Tipografia:**
- Display (títulos, números): `Bahnschrift` — a DIN condensada que vem no Windows.
  Cara de sinalização de backstage e ficha de palco. Fallbacks: `DIN Alternate`,
  `Segoe UI Variable Display`.
- Corpo: `Segoe UI Variable Text` / `Segoe UI`.

**Gesto de interação recorrente ("pegada de luz"):** toda superfície clicável
acende uma linha âmbar de 1px na borda superior no hover, como se entrasse na luz.
Aplicado em card de evento e card de instrutor.

**Fotos dos instrutores** aparecem em **preto e branco** e ganham cor no hover.
Quem não tiver arquivo cai num avatar de iniciais.

---

## 5. As telas

### 5.1 Login (`/login`)

Card central partido ao meio, copiado do sistema financeiro da casa para manter
coerência entre as ferramentas internas.

```
┌──────────────────────────┬──────────────────────────┐
│  [TS]                    │                          │
│                          │   Bem-vindo de volta     │
│  TradeStars              │   Entre com suas cre…    │
│  HUB DO PALESTRANTE      │                          │
│                          │   EMAIL                  │
│  • Seus eventos e leads  │   [✉  ______________]    │
│  • O kanban de cada…     │   SENHA                  │
│  • Quem comprou, o que…  │   [🔒 __________  👁]    │
│                          │   ☑ Manter conectado     │
│                          │   [  Acessar o Hub  → ]  │
│  © 2026 TRADESTARS       │   ACESSO RESTRITO…       │
└──────────────────────────┴──────────────────────────┘
    metade com vídeo            metade com formulário
```

- A metade esquerda é um **vídeo em loop, preto e branco, mudo** — imagens da gala
  da empresa (palco, plateia de gala, premiação). 720×960, 6,6 MB.
- O vídeo só carrega em tela grande, fora de economia de dados e sem preferência
  por menos movimento. Nos outros casos entra um frame estático.
- Erro de login é **sempre genérico** ("Email ou senha inválidos"), nunca dizendo
  qual campo falhou. Não mudar isso: revelaria quem trabalha na empresa.

### 5.2 Home — grade de eventos

```
Hub do Palestrante  TRADESTARS            [foto] Siqueira · Instrutor  Sair
─────────────────────────────────────────────────────────────────────────
SEUS EVENTOS

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ CXJ 3006      │ │ SP 4010       │ │ …             │
│               │ │               │ │               │
│  7     3   43%│ │  5     1   20%│ │               │
│ LEADS VENDAS  │ │ LEADS VENDAS  │ │               │
│       CONVERSÃO│ │      CONVERSÃO│ │              │
└───────────────┘ └───────────────┘ └───────────────┘
```

O título muda por perfil: "Seus eventos" para instrutor, "Todos os eventos" para
a gestão.

### 5.3 Evento — instrutores + kanban

```
← Seus eventos
CXJ 3006                                  7      3     43%
                                        LEADS VENDAS CONVERSÃO
─────────────────────────────────────────────────────────────
┌────────┐
│ (foto) │   ← faixa de instrutores; para o instrutor tem só ele,
│Siqueira│      para a gestão tem todos, e clicar filtra o quadro
│7 · 3   │
└────────┘

┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│01 NOVO     2 ││02 EM CONT. 3 ││03 CONVER.  1 ││04 NÃO AT.  0 │
├──────────────┤├──────────────┤├──────────────┤├──────────────┤
│┌────────────┐││┌────────────┐││┌────────────┐││              │
││Hérika R.   ││││Marcos Silva││││João Pedro  │││  Nenhum lead │
││55499980••••││││55119900••••││││55119900••••│││  nesta etapa │
││•••ika@ex.co││││•••cos@ex.co││││•••p@ex.com │││              │
││────────────││││            ││││────────────│││              │
││● Mentoria O││││            ││││● Curso Base│││              │
│└────────────┘││└────────────┘││└────────────┘││              │
└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

- **As colunas são geradas pelos dados**, nunca fixas: são as `EtapaName` que
  existirem naquele evento, ordenadas por `EtapaId`. Podem ser 3 ou 8.
- A numeração `01/02/03` existe porque o funil **é** uma sequência — o número diz
  em que altura do funil o instrutor está olhando.
- As colunas dividem a largura disponível (mínimo 232px). Com muitas etapas o
  quadro rola de lado.
- **Telefone e e-mail aparecem mascarados** (`55499980••••`, `•••ika@ex.com`).
- O card com venda mostra um **ponto verde + o nome do curso**. Não mostra valor.

### 5.4 Cadastro de instrutores (só gestão)

Aviso de "nomes órfãos" no topo, formulário de novo instrutor, tabela dos
cadastrados com ações (editar vínculos, resetar senha, desativar).

O **vínculo** é o conceito central: o nome do instrutor não é digitado, é escolhido
entre os nomes que realmente aparecem nos dados. Um instrutor pode ser dono de
várias grafias. Nome que aparece nos dados e não tem dono é sinalizado — sem isso,
o instrutor logaria numa tela vazia e ninguém saberia por quê.

### 5.5 Troca de senha obrigatória

Primeiro acesso cai numa tela única de definir senha, antes de liberar o resto.

---

## 6. Os dados reais

Duas tabelas no BigQuery. O que a interface recebe já vem mastigado pela API.

**Evento** = `PipelineName`. Exemplos reais de nome: `CXJ 3006`, `SP 4010` — são
sigla de cidade + número, curtos e sem significado visual.

**Etapas** = `EtapaName`. Exemplos: `Novo`, `Em contato`, `Convertido`,
`Não atendeu`.

**Instrutor** sai de um campo de texto `Conexao`, no formato
`{Modalidade} {Instrutor}` — ex.: `Presencial Elidiano`, `Online Marina`.
Modalidade existe (`Presencial` / `Online`) e **hoje não é exibida em lugar
nenhum** — é uma informação disponível e não usada, se for útil ao desenho.

**Lead** (o que o card recebe):

```json
{
  "nome": "Hérika Rodrigues",
  "telefone": "5549998033100",
  "email": "herika@ex.com",
  "etapaName": "Novo",
  "modalidade": "Presencial",
  "instrutor": "Elidiano",
  "vendeu": true,
  "curso": "Mentoria Ouro",
  "dataVenda": "2026-08-05",
  "vendedor": "Bruno Novak"
}
```

`vendedor` é quem fechou a venda, e **também não é exibido hoje** — só aparece no
tooltip. Se o negócio quiser destacar "vendido pelo instrutor × repassado ao
vendedor", esse é o campo.

**Resumo de evento / de instrutor:** `total`, `vendas`, `atendidos`,
`pctAtendido`, `taxaConversao`. Existe também `valorTotal`, mas **valores em R$
foram removidos da interface por decisão do produto** — não trazer de volta.

> **Aviso importante:** a tabela de leads está **vazia** hoje. Os dados reais
> ainda não caíram. Toda a interface precisa ficar decente com zero linha, e os
> estados vazios importam tanto quanto as telas cheias.

---

## 7. O que está travado

1. O escuro é o tema padrão e a identidade do produto. Existe um tema claro com botão no
   topo (desde 12/08), mas ele é a alternativa, não o ponto de partida do desenho.
2. Verde reservado para "vendeu".
3. Sem valores em R$.
4. Telefone e e-mail mascarados.
5. Mensagem de erro do login genérica.
6. Colunas do kanban geradas pelos dados, nunca uma lista fixa.
7. Instrutor não vê dado de colega — nem como opção.
8. As amarras técnicas da seção 3.

## 8. O que está aberto

Tudo o mais: layout, hierarquia, tipografia, densidade, o gesto de interação, a
forma dos cards, como a foto do instrutor é usada, estados vazios e de
carregamento, e como o kanban se comporta com muitas etapas.

O âmbar pode mudar, desde que **não** vire verde e o motivo da seção 4 continue
respeitado.

---

## 9. Onde a interface atual está fraca

Honestamente, para não perder tempo redescobrindo:

- **A faixa de instrutores para o instrutor** mostra um card único e solitário com
  a foto dele. Funciona, mas parece sobra de um layout feito para vários.
- **Os cards da home são pobres**: nome do evento e três números. Não têm data,
  nem local, nem noção de "quanto falta ligar" — que é o que a pessoa quer saber.
- **Não há estado de carregamento decente**: é um texto "Carregando eventos…".
- **A tela de cadastro é funcional e sem desenho** — foi feita para funcionar.
- **Não há nada guiando a ação.** O instrutor abre e vê um retrato do passado;
  não há "ligue para estes 4 hoje". É a maior oportunidade do produto.
- **O quadro não indica o tempo.** Um lead parado há duas semanas em "Novo" parece
  igual a um que entrou ontem. Os dados de data existem no BigQuery.

---

## 10. Como rodar para ver

```bash
npm start                  # dados reais (hoje, tabela vazia)
USAR_EXEMPLO=1 npm start   # dados de exemplo, 2 eventos e 12 leads
```

Abre em `http://localhost:3000`. Sem sessão, redireciona para `/login`.
