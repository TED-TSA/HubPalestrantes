# O que falta na base para o card do lead

**Pedido:** transformar cada lead do quadro num card com nome, e-mail parcial,
telefone parcial, **data de check-in** e **closer em atendimento** (se houver).

Nome, e-mail e telefone já estão na tela. Os outros dois **não têm fonte
confiável hoje**. Este documento é o levantamento, para o time de dados apontar de
onde eles devem sair.

Levantado em 17/08/2026, contra o que o Hub lê hoje.

---

## 1. A tabela que o Hub lê não tem os dois campos

`leads-ts.hub_uni.info_leads` — 878 linhas, todas as colunas:

```
Nome, Email, Telefone, IdContato, PipelineId, PipelineName,
EtapaId, EtapaName, Conexao, Palestrante
```

Nenhuma data de check-in. Nenhum campo de closer, vendedor ou atendente.

## 2. A tabela de check-in existe, mas o cruzamento não fecha

`leads-ts.Presenciais.Leads_Guests_Match` parece ser a resposta: é `info_leads`
cruzada com os convidados do evento, e traz `guest_checkedIn` e
`guest_checkedInAt`. O problema é a granularidade do match:

| Medida | Valor |
|---|---|
| Linhas | 1.653 |
| Contatos distintos (`IdContato`) | 567 |
| Contatos com **um único** guest | 31 |
| Contatos com 2 guests | 354 |
| Contatos com 3 ou mais | 181 (um deles com **126**) |

O match é por nome/e-mail/telefone contra **todos** os eventos, então quem foi a
mais de uma palestra casa com todas elas. Não há como escolher a linha certa: numa
amostra, um lead do funil **Presencial Balneário Camboriú** vinha com check-in do
evento `[0126]Sinop`.

Pior, o nome do evento na base de check-in é um código (`[3006]CXJ`, `2105BC`,
`[0108] SP/JAC`) que não se liga à cidade da palestra por nenhuma chave — só por
palpite de leitura humana.

A outra candidata, `leads-ts.Presenciais.Presenciais_sistema`, tem `check_in_date`
e 13.362 linhas, mas usa o mesmo código de evento e um dos eventos concentra 7.445
linhas, o que sugere carga duplicada.

**O que resolveria:** um campo de data de check-in na própria `info_leads`, ou uma
tabela de check-in com a mesma chave de evento que a palestra usa (cidade + data),
ou o `IdContato` presente nos dois lados.

**Atualização 19/08/2026 — a caminho.** Combinado adicionar `DataCheckin` direto
em `info_leads` (mesmo caminho que resolveu o closer via `Atendente`, seção 3).
Ainda não foi criada. O código já está preparado para o dia em que existir:
`server/data/queries.js` tem o comentário de onde plugar o `SELECT`, e
`server/domain/metricas.js` já lê `DataCheckin` tolerando a ausência — nenhuma
outra mudança de código deve ser necessária além de acrescentar a coluna na
query.

## 3. Closer — resolvido em 18/08/2026

`info_leads` ganhou a coluna `Atendente`, direto na mesma tabela do lead — não
precisou do cruzamento com `leads-ts.Unnichat_Closers.crm_ctrl_closers` que
tinha sido cogitado antes. `SQL_LEADS` já seleciona (`server/data/queries.js`),
e `enriquecerLeads` já mapeia pra `closer` (`server/domain/metricas.js`). O card
do lead mostra quando presente, e omite quando vazio.

---

## 4. De quebra: o dono do lead é uma aposta

**Atualizado em 18/08/2026 — parcialmente resolvido.** A atribuição passou a usar
`Palestrante` (não mais `Conexao`, que só 10 leads traziam preenchida): quando o
campo vem preenchido, os nomes ali (separados por "/") são os donos do lead — se
forem dois, o lead é dos dois juntos, sem tentar decidir qual dos dois é o "real".
Continua havendo o mesmo fallback de antes para quando `Palestrante` vem vazio:
todos que subiram ao palco daquela palestra, segundo `presencial_metricas`.

Isso não elimina 100% a aposta — `Palestrante` ainda traz o mesmo valor para todo
lead do evento (não é uma atribuição por pessoa), e às vezes diverge da base de
métricas (em São Paulo ele diz só `Luiz Hota`, enquanto `presencial_metricas`
registra `Jacsson Santos / Luiz Hota` no palco) — mas resolve o caso comum de "dois
instrutores, mesmo número", que agora é esperado e não mais um problema a esconder.

**O que resolveria de vez:** um campo que diga qual instrutor *individual* ficou
com aquele lead, não só quem estava no palco.

---

## 5. Uma cidade com duas datas empilha os leads na mais recente

Levantado em 18/08/2026, a partir de uma dúvida sobre Balneário Camboriú mostrando
138 leads com só 111 check-ins de lead no evento.

`info_leads` não tem data nem id de evento — só o nome da cidade (via
`PipelineName`). Quando a mesma cidade recebeu mais de uma palestra (Balneário
Camboriú teve 20/05 e 10/08), todo lead daquela cidade cai na palestra **mais
recente** ([server/domain/palestra.js](../server/domain/palestra.js),
`indexarPalestrasPorCidade`) — é a aposta mais razoável para lead em aberto, mas
significa que a palestra mais antiga da mesma cidade sempre aparece com **zero**
leads, mesmo que tenha tido atendimento na época.

Conferido no banco real: `balneario-camboriu-2026-05-20` tem 0 leads,
`balneario-camboriu-2026-08-10` tem os 138. Não dá para saber, com o dado de hoje,
se algum desses 138 é na verdade da palestra de maio.

**Pista encontrada, depois abandonada:** `info_leads.PipelineId` é diferente entre
os dois eventos de Balneário Camboriú (cada palestra é um CRM/pipeline separado no
Unnichat), mas nunca se achou um de-para entre `PipelineId` e a data/cidade
específica — e `presencial_metricas` não tem `PipelineId` nenhum. Essa via foi
deixada de lado quando surgiu a de baixo.

**Resolvido em código, 20/08/2026 — falta o upload de dados terminar.**
`info_leads` ganhou a coluna `eventName`, no formato `[ddmm]{SIGLA}` (ex.:
`[0108] SP/JAC` = 01/08, São Paulo — o `/JAC` depois da sigla é o instrutor,
ignorado). `presencial_metricas` trocou de fonte no mesmo dia (de
`validator-tradestars.tsflow` para `leads-ts.Presenciais`, mesmo schema) e ganhou
uma coluna `sigla` própria (`UDI`, `BH`, `BC`...) — a mesma convenção dos dois
lados. `server/domain/palestra.js` (`parseCodigoEvento`, `resolverPorCodigoEvento`)
casa os dois: sigla como identidade, data como desempate quando a sigla se repete
(hoje, só Balneário Camboriú — `BC` nas duas datas). Tolerância de 5 dias na data,
porque o evento dura mais de um dia e as duas bases não são garantidas bater no
dia exato — visto na base real: Manaus está em 03/06 em `presencial_metricas`, e o
primeiro lead com `eventName` preenchido trouxe `[0406]MAN` (04/06). Com sigla
única (o caso normal), a data nem chega a ser checada.

Continua caindo no fallback de cidade (a aposta na mais recente) quando o lead não
tem `eventName`. Em 20/08/2026, só **1 de 1136 leads** tinha a coluna preenchida
pela origem — pouco pra confiar sozinho.

**Backfill rodado em 20/08/2026, direto em `info_leads.eventName` (única tabela
escrita — `Guests` e `presencial_metricas` só foram lidas).** Como `eventName`
também existe em `leads-ts.Presenciais.Guests` (99,85% preenchido lá, mas cobrindo
histórico maior que as 25 palestras atuais, com grafia inconsistente — ex.: o
mesmo Balneário Camboriú aparece como `[1008] BC` numa data e `[2005]Balneário` na
outra), casar os dois lados por telefone completo não dava: a origem tem erro de
sintaxe de telefone entre as bases. A regra que fechou, por linha de `info_leads`:

1. Casa pelos **últimos 7 dígitos** do telefone contra `Guests` (tolera DDI/DDD
   diferentes entre as duas bases).
2. Decodifica cada `eventName` candidato e descarta o que não bate com nenhuma das
   25 palestras reais (ruído de outras campanhas, tipo "2k", "LISBOA").
3. Entre os que sobram, prefere o candidato cuja cidade bate com o `PipelineName`
   **daquela própria linha** — resolve sozinho o caso de um lead ter ido a mais de
   um evento (visto sobretudo em São Paulo).
4. Se ainda sobrar mais de um (mesma cidade, datas diferentes — só Balneário
   Camboriú repete isso hoje), desempata pelo `Palestrante` da linha contra quem
   estava no palco em cada candidato (`presencial_metricas.palestrante`).
5. Sem decisão segura mesmo assim → não mexe, fica como estava.

Resultado, sobre os 1135 que estavam vazios: **1045 resolvidos e escritos** (842
pares `IdContato`+`PipelineId` únicos, os 1045 vêm de linha duplicada — mesmo
problema de sempre — recebendo o mesmo valor nas duas cópias). 83 sem nenhum
candidato em `Guests`. 4 com candidato mas nenhum batendo na cidade da própria
linha (provável colisão de final de telefone com outra pessoa — corretamente
ignorado). 3 ambíguos mesmo depois do desempate — todos Balneário Camboriú com
Palestrante "Elidiano" nos dois casos (ele deu palestra nas duas datas, então o
nome sozinho não desempata). Cobertura foi de 1 para **1046 de 1136 leads**.

Formato escrito de volta é o canônico gerado por `formatarCodigoEvento()`
(`[ddmm]SIGLA`), não o texto cru da origem — evita herdar a inconsistência de
grafia que a `Guests` mostrou ter.

**Conferido depois do backfill:** Balneário Camboriú continua 0/102 — mas agora
por evidência, não por aposta. Dos leads da cidade em `info_leads`, 121 casaram
por telefone com `[1008]BC` (agosto) e **nenhum** com `[2005]BC` (maio); só 4
ficaram sem eventName resolvido. A dúvida original (se algum dos 102 seria na
verdade da palestra de maio) tem resposta: não — o problema descrito nesta seção
está fechado para o estado atual da base.

**Fonte mudou de novo em 21/08/2026 — esta passa a ser a definitiva.** O
`eventName` (seção acima) resolveu o histórico, mas dependia de cruzar com
`Guests` por telefone, com tolerância de dias e desempate por instrutor —
correto, mas indireto. A partir de 21/08/2026 o `PipelineName` em si passou a
trazer o código, sempre no mesmo formato: `"Presencial {Cidade} - [ddmm]
{SIGLA}"` (ex.: `"Presencial Balneário Camboriú - [1008] BAL"`). Isso elimina
por completo a necessidade de `Guests`, telefone, tolerância de dias ou
desempate por palestrante — a palestra sai direto do próprio nome do funil,
sem inferência nenhuma.

`server/domain/palestra.js` já lê os dois formatos: `parseCodigoEvento` deixou
de exigir que o código esteja no início da string (antes só funcionava com
`eventName` puro; agora acha o código em qualquer posição, inclusive depois do
nome da cidade), e `cidadeDoPipeline` corta a partir do `" - "` antes de
extrair a cidade, para o fallback antigo continuar funcionando em quem ainda
não tem código nenhum. `server/data/sincronizacao.js` tenta nesta ordem:
`eventName` solto → código dentro do `PipelineName` → fallback de cidade de
sempre. Como o formato novo é fixo e controlado pela própria origem (ao
contrário do `eventName`, que herdava histórico com grafia solta), esta é a via
que deve prevalecer a partir de agora — `eventName` fica como caminho de
transição enquanto pipelines antigos (já upados) convivem com os novos.

**Em aberto:** se a origem também vai renomear os `PipelineName` de pipelines
já existentes (histórico) para o formato novo, ou se isso vale só pra pipeline
criado daqui pra frente. No segundo caso, o histórico continua dependendo do
`eventName` já backfillado até esses leads saírem do funil.
