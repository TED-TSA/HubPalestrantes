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

Tamanho do frontend inteiro hoje: cerca de **1.400 linhas** (`app.js` e
`styles.css` somam 1.095). É pequeno de propósito.

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

- **Display:** `Franklin Gothic Medium`. Títulos em caixa baixa e peso médio.
- **Corpo:** `Corbel`. Carrega quase tudo: a v4 abandonou a caixa alta com
  espaçamento largo como estrutura.
- **A reserva do display não pode ser o Corbel.** Franklin Gothic vem com o
  Office, não com o Windows: em máquina sem ele a cadeia antiga caía no Corbel —
  a mesma fonte do corpo — e o contraste entre título e texto desaparecia. Hoje a
  reserva é `Segoe UI Variable Display` → `Segoe UI Semibold` → `Segoe UI` →
  `Tahoma`, todas diferentes do corpo. `Libre Franklin` saiu da lista: não é fonte
  de sistema, e o projeto não carrega fonte externa.
- **Mono:** `Cascadia Mono` / `Consolas` para telefone e e-mail — são dados de
  conferir dígito a dígito, não texto de ler.
- **Cantos quase retos:** 5px nos cards, 4px em campos e botões. Nada mais.
### 4.3 O corte diagonal

É o gesto que dá identidade às fotos. A foto entra pela direita e é
cortada por uma aresta inclinada, marcada por um fio âmbar de 1px.

- A inclinação é **30%** da largura da área de foto. A área em si mudou por tela:
  47% no card de evento, 62% no card de instrutor, 26% na faixa do evento.
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
  display em caixa baixa com uma régua âmbar acima, e o rodapé. Os itens
  numerados da versão anterior saíram.
- **Direita:** "Bem-vindo de volta", campos com ícone SVG, olho de mostrar senha,
  "Manter conectado", o botão âmbar "Acessar o hub →" e, no rodapé, o seletor de
  tema com ícone de sol.
- O vídeo só baixa em tela grande, fora de economia de dados e sem preferência
  por menos movimento. Nos outros casos fica o frame estático.
- Erro **sempre genérico** ("Email ou senha inválidos"). Não mudar: revelaria
  quem trabalha na empresa.

### 5.2 Home — grade de eventos

Título da seção em caixa baixa com uma frase ao lado ("3 palestras
registradas"). Abaixo dele, os filtros. Depois a grade: **três cards por linha**,
205px de altura (duas colunas abaixo de 1180px, uma abaixo de 760px).

- **Cidade na primeira linha, data na segunda**, com o ano ("10 ago 2026"). O
  corpo é o mesmo em todos os cards: o nome não encolhe mais conforme cresce, o
  que numa grade de três deixava a linha parecendo uma serra. Cidade longa quebra
  em duas linhas.
- Uma linha dizendo quem subiu ao palco: "Elidiano e Bam no palco".
- **Foto dos instrutores cortada na diagonal**, ocupando 40% do card.
- Métricas em linha no rodapé: número grande colado no rótulo pequeno, com a
  conversão em âmbar. **A conversão é sobre vendas totais**, não efetivas.
- **Barra de conversão** de 2px na base do card, proporcional ao percentual.

**O texto tem teto de largura, e ele não é o mesmo em cima e embaixo.** A aresta
da foto é diagonal: no topo ela só começa depois de 70% da largura, na base já
chegou aos 60%. Por isso o nome pode ser mais largo (70%) que as métricas (58%).
Com um teto só para os dois, ou o nome quebrava sem precisar, ou os números
passavam por baixo do rosto.

**Filtros:** período (mês e ano), cidade e palestrante, em `<select>`. Rodam no
cliente — a home já recebe todos os eventos num payload só. As opções saem dos
eventos que a pessoa tem na mão, então nenhuma escolha leva a uma tela vazia, e um
seletor com uma única opção não aparece. Com filtro ligado, a frase do título vira
"2 de 3 palestras".

### 5.3 Evento

- Uma faixa de 150px com sigla + número grandes, a linha de contexto e as três
  métricas à direita, com a foto cortada na diagonal no canto.
- **Instrutor vendo o próprio evento:** uma barra horizontal com foto, nome e
  "Seu recorte deste evento", métricas à direita. (Isto resolveu uma fraqueza
  apontada no briefing anterior — antes era um card solitário que parecia sobra
  de um layout feito para vários.)
- **Painel de números**, presença de um lado e vendas do outro. Na presença, o
  destaque é o **check-in de leads** e a taxa de presentes; cadastrados, check-in
  geral, tribo e aldeia ficam na linha secundária. O check-in de lead é o número
  do palestrante — é dessa gente que sai o trabalho dele depois do evento;
  tribo e aldeia já eram casa, e o geral é a soma dos três.
- **Gestão:** grade "Instrutores no palco", nome em display e leads no pé. Clicar
  filtra o quadro. Quando há lead sem dono identificado (o caso normal, ver seção
  8), a frase do título avisa que esse lead conta para todos que subiram ao palco
  — sem isso, ver dois instrutores com o mesmo número de leads parecia erro.
- **Kanban de verdade:** o quadro mostra **todas as etapas do funil**, com lead ou
  sem, na ordem de `config.ordemEtapas`. Etapa vazia também é informação
  ("ninguém pagou tribo ainda"). São 13 raias hoje, e o quadro rola na horizontal.
  Etapa que apareça nos dados sem estar na configuração entra no fim, em ordem
  alfabética, e é o sinal de que a lista ficou velha.
- Card de lead: nome (e, para a gestão, o nome do instrutor à direita), telefone e
  e-mail mascarados em mono.

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

A versão de celular do kanban **foi implementada** na v4: abaixo de 760px as
colunas somem e entram chips de etapa, mostrando uma etapa por vez.

---

## 7. Onde ainda está fraco

Honestamente, para não gastarem tempo redescobrindo:

- **A tela não guia ação nenhuma.** O instrutor abre e vê um retrato do passado.
  O que ele quer é "ligue para estes 4 hoje". Continua sendo a maior
  oportunidade do produto, e nada no desenho atual endereça isso.
- **O quadro não mostra tempo.** Um lead parado há duas semanas em "Em contato"
  parece igual a um que entrou ontem. E a data de check-in que resolveria isso
  **não existe de forma confiável na base** — ver `docs/dados-que-faltam.md`.
- **O card do lead não tem data de check-in nem closer**, que foram pedidos. Mesmo
  motivo do item acima.
- **O dono do lead é uma aposta.** Só 10 dos 878 leads trazem `Conexao`
  preenchida; o resto é creditado a todos que subiram ao palco. Isso faz o filtro
  por instrutor devolver o mesmo quadro em qualquer opção. A tela hoje avisa, mas
  quem resolve é a origem dos dados.
- **13 raias no quadro** dão bastante rolagem horizontal para chegar às últimas
  etapas. Foi pedido assim, mas vale observar em uso.
- **O botão de tema só existe no app**, não na tela de login. Quem entra pela
  primeira vez pega a preferência do sistema e não tem como mudar antes de logar.

---

## 8. Aviso sobre os dados

Os dados reais caíram: **878 leads em 7 funis**. Os estados vazios continuam
valendo — um instrutor novo abre a tela sem nada —, mas os nomes já são os de
verdade, e eles são mais longos e mais bagunçados que os do conjunto de exemplo:

- **Etapa vem com grafia instável.** `JÁ É MEMBRO` (9 leads) e `JA É MEMBRO` (18)
  são a mesma etapa escrita de dois jeitos. O quadro agrupa ignorando acento e
  caixa, senão a mesma etapa virava duas colunas.
- **A origem grava ausência como a palavra `"null"`**, não como NULL de banco.
  171 leads vêm com funil e etapa assim, e são descartados — o número aparece no
  aviso da gestão para o problema não passar despercebido.
- **Cidade de verdade é longa** ("Balneário Camboriú", "São José dos Campos"),
  e é por isso que o card da home tem teto de largura e permite duas linhas.

**Dos cinco palestrantes que aparecem no vídeo do login, dois ainda não têm foto
nem cadastro:** Luiz Hota e Tonho. Eles caem no avatar de iniciais.

---

## 9. Para rodar e ver

```bash
USAR_EXEMPLO=1 npm start   # dados de exemplo, dois eventos
npm start                  # dados reais (hoje, tela vazia)
```

Abre em `http://localhost:3000`. Sem sessão, redireciona para `/login`.
