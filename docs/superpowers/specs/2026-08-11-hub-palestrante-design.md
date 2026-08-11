# Hub do Palestrante — Design / Spec

**Data:** 2026-08-11
**Empresa:** TradeStars
**Autor:** bi03@tradestars.com.br + Claude

---

## 1. Contexto e objetivo

A TradeStars tem **instrutores/palestrantes** que realizam palestras (eventos) e vendem produtos
durante elas. Em cada palestra o instrutor coleta os contatos (leads) dos participantes e depois
liga para eles. Alguns leads o instrutor consegue falar; os que ele **não** consegue são repassados
para os **vendedores**.

O objetivo do sistema é dar visibilidade, **por evento e por instrutor**, de:

- Como está o **atendimento** de cada lead (um quadro kanban do funil).
- Quem **comprou** e quem **não comprou**, e qual produto/valor.
- A separação entre leads **atendidos pelo instrutor** e **repassados ao vendedor**.

O produto deve ser **simples de usar** e ter uma **interface bonita** (visual sóbrio e premium),
com a **foto de cada instrutor em preto e branco** por evento.

Nome do projeto: **Hub do Palestrante**.

---

## 2. Fontes de dados (BigQuery — projeto `leads-ts`)

O acesso ao BigQuery já está autenticado na máquina (service account do ambiente; `bq` CLI e
`gcloud` funcionando). Duas views alimentam o sistema:

### 2.1 Leads — `leads-ts.hub_uni.info_leads`

O que o instrutor coletou na palestra e o estado do atendimento. Hoje contém **1 linha de
exemplo**; os dados reais chegarão depois. Colunas:

| Coluna | Tipo | Uso no sistema |
|---|---|---|
| `Nome` | STRING | Nome do lead |
| `Email` | STRING | E-mail do lead (chave de cruzamento com vendas) |
| `Telefone` | STRING | Telefone do lead (chave principal de cruzamento com vendas) |
| `IdContato` | STRING | Identificador do contato |
| `PipelineId` | STRING | Id do evento |
| `PipelineName` | STRING | **Evento** (ex.: "CXJ 3006") |
| `EtapaId` | STRING | Id da etapa (usado para **ordenar** as colunas do kanban) |
| `EtapaName` | STRING | **Etapa do atendimento** (ex.: "EM CONTATO") = colunas do kanban |
| `Conexao` | STRING | Modalidade + **instrutor** (ex.: "Presencial Elidiano") |

### 2.2 Vendas — `leads-ts.pipedrive_rt.vw_ald_trb_gold`

Deals do Pipedrive. Base robusta: ~10.455 negócios de 2022 até hoje. Colunas relevantes:

| Coluna | Tipo | Uso no sistema |
|---|---|---|
| `person_name` | STRING | Nome da pessoa |
| `person_phone` | STRING | Telefone (cruzamento com `info_leads.Telefone`) |
| `person_email` | STRING | E-mail (cruzamento com `info_leads.Email`) |
| `curso_comprado` | STRING | Produto comprado (exibido no selo "VENDEU") |
| `valor_pago` | FLOAT | Valor pago |
| `data_venda_brt` | DATE | Data da venda |
| `status_pagamento` | STRING | Status do pagamento |
| `stage_name` | STRING | Etapa do deal no Pipedrive |
| `label_padronizada` | STRING | Campanha/produto padronizado |
| `Equipe` | STRING | **Vendedor** responsável pelo deal |
| `origem` | STRING | Origem (ex.: "ALDEIA") |
| `is_cancelled_flag` | BOOLEAN | Marca deals cancelados (excluir da contagem de venda) |

---

## 3. Regras de negócio

### 3.1 Evento
`Evento = PipelineName`. Cada valor distinto de `PipelineName` é um evento na home.

### 3.2 Instrutor
Extraído do campo `Conexao`, no padrão **`{Modalidade} {Instrutor}`**:
- Modalidade = primeira palavra (ex.: "Presencial").
- Instrutor = o restante (ex.: "Elidiano").

O parser deve ser tolerante: se o padrão não bater (valor vazio, sem espaço, etc.), o lead vai para
um instrutor "Não identificado" em vez de quebrar. Um mesmo evento pode ter vários instrutores.

### 3.3 Etapas do kanban (data-driven)
As colunas do kanban são as `EtapaName` distintas **que existirem naquele evento**, ordenadas por
`EtapaId` (ordem do funil no Pipedrive). Nada de lista fixa hardcoded — o quadro se monta conforme
os dados caem.

### 3.4 Vendeu / não vendeu (cruzamento leads ↔ vendas)
Um lead é marcado como **VENDEU** se casar com um registro de venda por **telefone OU e-mail**:
- Telefone: normalizar ambos os lados (só dígitos; comparar pelos últimos 8–9 dígitos para absorver
  DDI/DDD e zeros à esquerda diferentes).
- E-mail: comparar em minúsculas, sem espaços.
- Ignorar deals com `is_cancelled_flag = true`.
- Quando casar, exibir `curso_comprado`, `valor_pago` e `data_venda_brt`. Se houver mais de uma
  venda para o mesmo lead, usar a mais recente (`data_venda_brt`) e somar o valor total no rodapé
  do instrutor.

### 3.5 Instrutor × vendedor (parâmetro configurável)
Como os dados reais ainda não caíram, a marcação exata de "lead repassado ao vendedor" ainda não é
conhecida. O sistema trata isso como **estratégia configurável** num único ponto de código
(`config`), com duas hipóteses previstas:
1. **Por etapa** — uma ou mais `EtapaName` significam "repassado ao vendedor".
2. **Por venda com vendedor** — o lead virou deal na base de vendas com uma `Equipe` preenchida.

Default do MVP: expor o toggle "atendidos pelo instrutor × repassados ao vendedor" na UI, com a
lógica isolada para cravar assim que os dados reais chegarem. O MVP não quebra se a distinção ainda
não estiver definida (mostra todos como "atendimento do instrutor").

---

## 4. Arquitetura

Aplicação web com backend ao vivo, três camadas com responsabilidades isoladas:

```
Browser (SPA)  ──HTTP──>  Express API  ──>  Camada de dados (BigQuery)
   frontend/               server/            server/data/
```

### 4.1 Camada de dados — `server/data/`
- Encapsula **todas** as queries do BigQuery. Nenhuma query vive na camada HTTP nem no frontend.
- Acesso ao BigQuery reusando a auth do ambiente. Estratégia: tentar a biblioteca oficial
  `@google-cloud/bigquery` (autentica via ADC/metadata da service account já ativa); se a auth não
  estiver disponível, cair para o `bq query --format=json` via `child_process`. A escolha é
  detalhada no plano de implementação; a interface pública do módulo não muda entre as duas.
- Funções previstas: `listarEventos()`, `detalheEvento(pipelineId)` (leads + instrutores + etapas),
  e o cruzamento com vendas.
- **Cache em memória** com TTL (~60s) por chave de query, para aguentar vários acessos simultâneos
  sem reconsultar o BigQuery a cada request.

### 4.2 API — `server/` (Express)
Endpoints REST, JSON, finos (só orquestram a camada de dados):
- `GET /api/eventos` → lista de eventos com métricas de resumo.
- `GET /api/eventos/:pipelineId` → detalhe: instrutores, etapas (colunas) e leads (cards) já com o
  status de venda cruzado.
- `GET /api/health` → sanidade (checa conexão com BigQuery).
- Serve também os arquivos estáticos do frontend.

### 4.3 Frontend — `frontend/`
- **Uma página**, sem etapa de build (HTML + CSS + JS moderno servidos pelo Express).
- Rotas no cliente: home (grade de eventos) e detalhe do evento (instrutores + kanban).
- Consome a API via `fetch`. Estados de carregando/erro/vazio tratados.

### 4.4 Config — `config.js` / `.env`
- `PROJECT_ID` (`leads-ts`), nomes das views, TTL do cache, porta.
- Estratégia de instrutor × vendedor (seção 3.5).

---

## 5. Telas / UX

### 5.1 Home — grade de eventos
Cards de evento (um por `PipelineName`), cada um com: nome do evento, nº de leads, % já atendido,
nº de vendas e valor gerado. Clique abre o detalhe.

### 5.2 Detalhe do evento
- **Faixa de instrutores:** foto de cada instrutor em **preto e branco** (grayscale via CSS),
  ganhando cor no hover. Sob a foto: nº de leads, % atendido, nº de vendas e valor gerado por aquele
  instrutor. Sem foto → **avatar de iniciais** elegante.
- **Kanban ("cambão"):** colunas = etapas (seção 3.3), com rolagem horizontal. Cada card = um lead,
  com nome, telefone e **selo verde "VENDEU"** (curso + valor) quando houver venda cruzada.
- **Filtros:** por instrutor e toggle "atendidos pelo instrutor × repassados ao vendedor".

---

## 6. Visual — sóbrio e premium

- Paleta neutra e elegante, com suporte a tema claro/escuro; um único tom de destaque para ações e
  para o selo de venda (verde discreto).
- Tipografia forte e legível; boa hierarquia de títulos e números.
- Fotos dos instrutores em grayscale, ganhando cor no hover; micro-animações discretas (transições
  suaves, sem exageros).
- Cara de produto sério, não de planilha. Espaçamento generoso, cards com sombra leve.

---

## 7. Fotos dos instrutores

Os dados **não** trazem fotos. Convenção:
- Pasta `frontend/public/instrutores/` com arquivos nomeados pelo instrutor de forma normalizada
  (ex.: `elidiano.jpg` — minúsculas, sem acento, sem espaço).
- O sistema resolve a foto pelo nome do instrutor; se o arquivo não existir, mostra o **avatar de
  iniciais**.
- O usuário fornece as fotos quando quiser; a ausência não quebra a interface.

---

## 8. Fora de escopo (YAGNI nesta versão)

- Autenticação/login de usuários.
- Escrita de volta no Pipedrive/BigQuery (o sistema é **somente leitura**).
- Drag-and-drop de cards entre etapas (o kanban é de **visualização**, não de edição).
- Relatórios exportáveis (PDF/Excel) e histórico temporal.
- App mobile nativo (mas o layout deve ser responsável/utilizável no navegador do celular).

---

## 9. Riscos / pontos a cravar quando os dados reais caírem

1. **Padrão do `Conexao`** — confirmar que é sempre `{Modalidade} {Instrutor}` e se há modalidades
   além de "Presencial" (ex.: "Online"). Parser tolerante mitiga.
2. **Instrutor × vendedor** — definir a marcação real (seção 3.5).
3. **Formato de telefone** — validar a normalização de `Telefone` vs `person_phone` com dados reais
   (DDI, DDD, 9º dígito).
4. **Ordenação das etapas** — confirmar que `EtapaId` reflete a ordem do funil.
5. **Volume** — a base de vendas tem ~10k linhas; validar performance do cruzamento e ajustar o
   TTL/estratégia de cache se necessário.

---

## 10. Critérios de sucesso

- Abrir a home e ver os eventos existentes com métricas corretas.
- Entrar num evento e ver os instrutores (com foto grayscale) e o kanban montado a partir das
  etapas reais.
- Cada lead mostra corretamente se **vendeu** (com curso e valor) cruzando por telefone/e-mail.
- Dados **ao vivo** do BigQuery (com cache curto), acessível por várias pessoas via link.
- Interface **sóbria e premium**, simples de navegar.
