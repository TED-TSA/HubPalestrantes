# Hub do Palestrante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app web que, lendo o BigQuery ao vivo, mostra por evento e por instrutor o kanban de atendimento dos leads e quem comprou (cruzando leads com vendas).

**Architecture:** Backend Node + Express em três camadas isoladas — domínio (lógica pura, testável), dados (BigQuery via `bq` CLI + cache em memória) e API REST. Frontend de página única (sem build) servido pelo Express, visual sóbrio e premium. O cruzamento leads↔vendas é feito no domínio (testável), não no SQL.

**Tech Stack:** Node 25 (ESM), Express 4, `node:test` (runner nativo, zero deps de teste), `bq` CLI (auth já existente na máquina). Frontend em HTML/CSS/JS moderno, sem framework nem build.

## Global Constraints

- **Runtime:** Node ESM (`"type": "module"`). Imports com extensão `.js`.
- **Dependência de produção única:** `express`. Testes só com `node:test` + `node:assert/strict`. Nada de libs de teste externas.
- **Acesso a dados:** somente leitura. Todo SQL vive em `server/data/queries.js`; nenhuma query fora da camada `server/data/`.
- **BigQuery:** projeto `leads-ts`. Views: leads = `leads-ts.hub_uni.info_leads`; vendas = `leads-ts.pipedrive_rt.vw_ald_trb_gold`. A view de leads pode estar **vazia** — todo estado vazio deve ser tratado, nunca quebrar.
- **Idioma:** toda a UI e mensagens em português correto (com acentos).
- **Chave de cruzamento:** telefone (últimos 8 dígitos) OU e-mail (minúsculas/trim). Ignorar vendas com `is_cancelled_flag = true`.
- **Dados de exemplo:** com `USAR_EXEMPLO=1`, o sistema usa fixtures embutidas em vez do BigQuery (para desenvolver/validar a UI com a view vazia).

---

### Task 1: Scaffold do projeto + servidor de saúde

**Files:**
- Create: `package.json`
- Create: `config.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `frontend/index.html` (placeholder mínimo)

**Interfaces:**
- Produces: `criarApp(deps?) -> express.Application` (em `server/app.js`); `config` objeto (em `config.js`) com `{ projectId, cacheTtlMs, port, usarExemplo }`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "hub-palestrante",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
```

- [ ] **Step 2: Criar `config.js`**

```js
export const config = {
  projectId: 'leads-ts',
  cacheTtlMs: 60_000,
  port: Number(process.env.PORT) || 3000,
  usarExemplo: process.env.USAR_EXEMPLO === '1',
};
```

- [ ] **Step 3: Criar `server/app.js`** (sem rotas de negócio ainda, só health e estáticos)

```js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function criarApp() {
  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(dir, '..', 'frontend')));
  return app;
}
```

- [ ] **Step 4: Criar `server/index.js`**

```js
import { criarApp } from './app.js';
import { config } from '../config.js';

const app = criarApp();
app.listen(config.port, () => {
  console.log(`Hub do Palestrante em http://localhost:${config.port}`);
});
```

- [ ] **Step 5: Criar `frontend/index.html`** (placeholder)

```html
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Hub do Palestrante</title></head>
<body><h1>Hub do Palestrante</h1></body>
</html>
```

- [ ] **Step 6: Instalar e verificar**

Run: `npm install`
Then run (background): `npm start`
Then run: `curl -s http://localhost:3000/api/health`
Expected: `{"ok":true}`. Também `curl -s http://localhost:3000/` retorna o HTML placeholder. Parar o servidor depois.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json config.js server/ frontend/
git commit -m "feat: scaffold do app (express + health + estaticos)"
```

---

### Task 2: Domínio — helpers de texto/chave (`domain/texto.js`)

**Files:**
- Create: `server/domain/texto.js`
- Test: `test/texto.test.js`

**Interfaces:**
- Produces:
  - `soDigitos(s: string) -> string` (só dígitos)
  - `chaveTelefone(s: string) -> string` (últimos 8 dígitos, ou `''` se <8)
  - `normalizarEmail(s: string) -> string` (trim + minúsculas)
  - `slug(s: string) -> string` (minúsculas, sem acento, não-alfanumérico→`-`)

- [ ] **Step 1: Escrever o teste que falha** — `test/texto.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soDigitos, chaveTelefone, normalizarEmail, slug } from '../server/domain/texto.js';

test('soDigitos remove tudo que não é dígito', () => {
  assert.equal(soDigitos('+55 (49) 99803-3100'), '5549998033100');
  assert.equal(soDigitos(null), '');
});

test('chaveTelefone pega os últimos 8 dígitos', () => {
  assert.equal(chaveTelefone('+55 49 99803-3100'), '98033100');
  assert.equal(chaveTelefone('351912280468'), '12280468');
  assert.equal(chaveTelefone('123'), '');
});

test('normalizarEmail faz trim e minúsculas', () => {
  assert.equal(normalizarEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(normalizarEmail(undefined), '');
});

test('slug remove acentos e normaliza', () => {
  assert.equal(slug('João Pedro'), 'joao-pedro');
  assert.equal(slug('CXJ 3006'), 'cxj-3006');
  assert.equal(slug('Elidiano'), 'elidiano');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/texto.test.js`
Expected: FAIL (módulo/inexistente).

- [ ] **Step 3: Implementar `server/domain/texto.js`**

```js
export function soDigitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export function chaveTelefone(s) {
  const d = soDigitos(s);
  return d.length >= 8 ? d.slice(-8) : '';
}

export function normalizarEmail(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function slug(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/texto.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add server/domain/texto.js test/texto.test.js
git commit -m "feat: helpers de texto e chave (telefone/email/slug)"
```

---

### Task 3: Domínio — parser de instrutor (`domain/instrutor.js`)

**Files:**
- Create: `server/domain/instrutor.js`
- Test: `test/instrutor.test.js`

**Interfaces:**
- Produces: `parseConexao(conexao: string) -> { modalidade: string, instrutor: string }`
  - "Presencial Elidiano" → `{ modalidade: 'Presencial', instrutor: 'Elidiano' }`
  - vazio → `{ modalidade: '', instrutor: 'Não identificado' }`
  - sem espaço → `{ modalidade: '', instrutor: <string toda> }`

- [ ] **Step 1: Escrever o teste que falha** — `test/instrutor.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConexao } from '../server/domain/instrutor.js';

test('separa modalidade e instrutor', () => {
  assert.deepEqual(parseConexao('Presencial Elidiano'),
    { modalidade: 'Presencial', instrutor: 'Elidiano' });
});

test('instrutor com nome composto', () => {
  assert.deepEqual(parseConexao('Online Ana Paula'),
    { modalidade: 'Online', instrutor: 'Ana Paula' });
});

test('vazio vira Não identificado', () => {
  assert.deepEqual(parseConexao(''),
    { modalidade: '', instrutor: 'Não identificado' });
  assert.deepEqual(parseConexao(null),
    { modalidade: '', instrutor: 'Não identificado' });
});

test('sem espaço, tudo é instrutor', () => {
  assert.deepEqual(parseConexao('Fulano'),
    { modalidade: '', instrutor: 'Fulano' });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/instrutor.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/domain/instrutor.js`**

```js
export function parseConexao(conexao) {
  const s = String(conexao ?? '').trim();
  if (!s) return { modalidade: '', instrutor: 'Não identificado' };
  const i = s.indexOf(' ');
  if (i === -1) return { modalidade: '', instrutor: s };
  return { modalidade: s.slice(0, i), instrutor: s.slice(i + 1).trim() };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/instrutor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/domain/instrutor.js test/instrutor.test.js
git commit -m "feat: parser de instrutor a partir do campo Conexao"
```

---

### Task 4: Domínio — montagem do kanban (`domain/kanban.js`)

**Files:**
- Create: `server/domain/kanban.js`
- Test: `test/kanban.test.js`

**Interfaces:**
- Consumes: leads no formato enriquecido com `{ etapaId, etapaName }` (ver Task 6).
- Produces: `montarColunas(leads: Lead[]) -> Coluna[]` onde `Coluna = { etapaId, etapaName, leads: Lead[] }`. Colunas ordenadas por `etapaId` numérico asc; ids não-numéricos vão ao fim (ordem alfabética por `etapaName`).

- [ ] **Step 1: Escrever o teste que falha** — `test/kanban.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarColunas } from '../server/domain/kanban.js';

const leads = [
  { nome: 'A', etapaId: '2', etapaName: 'Em contato' },
  { nome: 'B', etapaId: '1', etapaName: 'Novo' },
  { nome: 'C', etapaId: '2', etapaName: 'Em contato' },
  { nome: 'D', etapaId: '3', etapaName: 'Convertido' },
];

test('agrupa leads por etapa e ordena por etapaId', () => {
  const cols = montarColunas(leads);
  assert.deepEqual(cols.map(c => c.etapaName), ['Novo', 'Em contato', 'Convertido']);
  assert.equal(cols[1].leads.length, 2);
});

test('lista vazia gera zero colunas', () => {
  assert.deepEqual(montarColunas([]), []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/kanban.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/domain/kanban.js`**

```js
export function montarColunas(leads) {
  const mapa = new Map();
  for (const l of leads) {
    const key = l.etapaName;
    if (!mapa.has(key)) mapa.set(key, { etapaId: l.etapaId, etapaName: key, leads: [] });
    mapa.get(key).leads.push(l);
  }
  return [...mapa.values()].sort((a, b) => {
    const na = Number(a.etapaId), nb = Number(b.etapaId);
    const aNum = a.etapaId !== '' && !Number.isNaN(na);
    const bNum = b.etapaId !== '' && !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.etapaName.localeCompare(b.etapaName);
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/kanban.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/domain/kanban.js test/kanban.test.js
git commit -m "feat: montagem das colunas do kanban por etapa"
```

---

### Task 5: Domínio — cruzamento com vendas (`domain/vendas.js`)

**Files:**
- Create: `server/domain/vendas.js`
- Test: `test/vendas.test.js`

**Interfaces:**
- Consumes: `chaveTelefone`, `normalizarEmail` (Task 2). Linhas de venda com `{ person_phone, person_email, curso_comprado, valor_pago, data_venda, Equipe }` (uma linha por pessoa, a mais recente).
- Produces:
  - `indexarVendas(rows) -> { porTelefone: Map, porEmail: Map }`
  - `cruzarLead(lead: {Telefone, Email}, index) -> venda | null` (casa por telefone, senão por e-mail)

- [ ] **Step 1: Escrever o teste que falha** — `test/vendas.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexarVendas, cruzarLead } from '../server/domain/vendas.js';

const vendas = [
  { person_phone: '5549998033100', person_email: 'a@x.com', curso_comprado: 'Curso A', valor_pago: 697, data_venda: '2026-08-01', Equipe: 'Bruno' },
  { person_phone: '', person_email: 'b@x.com', curso_comprado: 'Curso B', valor_pago: 1200, data_venda: '2026-07-01', Equipe: 'Ana' },
];

test('casa lead por telefone', () => {
  const idx = indexarVendas(vendas);
  const v = cruzarLead({ Telefone: '(49) 99803-3100', Email: 'zzz@x.com' }, idx);
  assert.equal(v?.curso_comprado, 'Curso A');
});

test('casa por e-mail quando telefone não bate', () => {
  const idx = indexarVendas(vendas);
  const v = cruzarLead({ Telefone: '', Email: 'B@X.com' }, idx);
  assert.equal(v?.curso_comprado, 'Curso B');
});

test('sem correspondência retorna null', () => {
  const idx = indexarVendas(vendas);
  assert.equal(cruzarLead({ Telefone: '11111111111', Email: 'no@x.com' }, idx), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/vendas.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/domain/vendas.js`**

```js
import { chaveTelefone, normalizarEmail } from './texto.js';

export function indexarVendas(rows) {
  const porTelefone = new Map();
  const porEmail = new Map();
  for (const v of rows ?? []) {
    const kt = chaveTelefone(v.person_phone);
    const ke = normalizarEmail(v.person_email);
    if (kt && !porTelefone.has(kt)) porTelefone.set(kt, v);
    if (ke && !porEmail.has(ke)) porEmail.set(ke, v);
  }
  return { porTelefone, porEmail };
}

export function cruzarLead(lead, index) {
  const kt = chaveTelefone(lead.Telefone);
  const ke = normalizarEmail(lead.Email);
  return (kt && index.porTelefone.get(kt)) || (ke && index.porEmail.get(ke)) || null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/vendas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/domain/vendas.js test/vendas.test.js
git commit -m "feat: cruzamento de leads com vendas por telefone/email"
```

---

### Task 6: Domínio — enriquecimento e métricas (`domain/metricas.js`)

**Files:**
- Create: `server/domain/metricas.js`
- Test: `test/metricas.test.js`

**Interfaces:**
- Consumes: `parseConexao` (Task 3), `slug` (Task 2), `cruzarLead` (Task 5).
- Produces:
  - `enriquecerLeads(leadsRaw, vendasIndex) -> LeadEnriquecido[]` onde
    `LeadEnriquecido = { nome, telefone, email, evento, etapaId, etapaName, modalidade, instrutor, instrutorSlug, vendeu, curso, valorPago, dataVenda, vendedor }`
  - `resumoEvento(leads) -> { total, vendas, valorTotal, atendidos, pctAtendido, taxaConversao }`
    (atendido = lead cuja `etapaId` numérica não é a menor presente)
  - `resumoInstrutores(leads) -> Array<{ instrutor, slug, ...resumoEvento }>` ordenado por `valorTotal` desc

- [ ] **Step 1: Escrever o teste que falha** — `test/metricas.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enriquecerLeads, resumoEvento, resumoInstrutores } from '../server/domain/metricas.js';
import { indexarVendas } from '../server/domain/vendas.js';

const raw = [
  { Nome: 'A', Telefone: '5549998033100', Email: 'a@x.com', PipelineName: 'CXJ 3006', EtapaId: '1', EtapaName: 'Novo', Conexao: 'Presencial Elidiano' },
  { Nome: 'B', Telefone: '551190000000', Email: 'b@x.com', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Elidiano' },
  { Nome: 'C', Telefone: '551190000001', Email: 'c@x.com', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Online Ana' },
];
const vendas = [{ person_phone: '5549998033100', person_email: 'a@x.com', curso_comprado: 'Curso A', valor_pago: 697, data_venda: '2026-08-01', Equipe: 'Bruno' }];

test('enriquece leads com instrutor e venda', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  assert.equal(leads[0].instrutor, 'Elidiano');
  assert.equal(leads[0].instrutorSlug, 'elidiano');
  assert.equal(leads[0].vendeu, true);
  assert.equal(leads[0].curso, 'Curso A');
  assert.equal(leads[1].vendeu, false);
});

test('resumoEvento conta total, vendas e atendidos', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  const r = resumoEvento(leads);
  assert.equal(r.total, 3);
  assert.equal(r.vendas, 1);
  assert.equal(r.valorTotal, 697);
  assert.equal(r.atendidos, 2); // etapaId 2 e 2 (não são a menor = 1)
});

test('resumoInstrutores agrupa e ordena por valor', () => {
  const leads = enriquecerLeads(raw, indexarVendas(vendas));
  const ins = resumoInstrutores(leads);
  assert.equal(ins[0].instrutor, 'Elidiano');
  assert.equal(ins[0].vendas, 1);
  assert.equal(ins.length, 2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/metricas.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/domain/metricas.js`**

```js
import { parseConexao } from './instrutor.js';
import { slug } from './texto.js';
import { cruzarLead } from './vendas.js';

export function enriquecerLeads(leadsRaw, vendasIndex) {
  return (leadsRaw ?? []).map((l) => {
    const { modalidade, instrutor } = parseConexao(l.Conexao);
    const venda = cruzarLead(l, vendasIndex);
    return {
      nome: l.Nome ?? '',
      telefone: l.Telefone ?? '',
      email: l.Email ?? '',
      evento: l.PipelineName ?? 'Sem evento',
      etapaId: l.EtapaId ?? '',
      etapaName: l.EtapaName ?? 'Sem etapa',
      modalidade,
      instrutor,
      instrutorSlug: slug(instrutor),
      vendeu: !!venda,
      curso: venda?.curso_comprado ?? null,
      valorPago: venda ? Number(venda.valor_pago ?? 0) || 0 : 0,
      dataVenda: venda?.data_venda ?? null,
      vendedor: venda?.Equipe ?? null,
    };
  });
}

export function resumoEvento(leads) {
  const total = leads.length;
  const vendas = leads.filter((l) => l.vendeu).length;
  const valorTotal = leads.reduce((s, l) => s + (l.valorPago || 0), 0);
  const ids = leads.map((l) => Number(l.etapaId)).filter((n) => !Number.isNaN(n));
  const primeira = ids.length ? Math.min(...ids) : null;
  const atendidos = primeira == null ? 0
    : leads.filter((l) => Number(l.etapaId) !== primeira).length;
  return {
    total, vendas, valorTotal, atendidos,
    pctAtendido: total ? atendidos / total : 0,
    taxaConversao: total ? vendas / total : 0,
  };
}

export function resumoInstrutores(leads) {
  const grupos = new Map();
  for (const l of leads) {
    if (!grupos.has(l.instrutor)) grupos.set(l.instrutor, []);
    grupos.get(l.instrutor).push(l);
  }
  return [...grupos.entries()]
    .map(([instrutor, ls]) => ({ instrutor, slug: ls[0].instrutorSlug, ...resumoEvento(ls) }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/metricas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/domain/metricas.js test/metricas.test.js
git commit -m "feat: enriquecimento de leads e metricas por evento/instrutor"
```

---

### Task 7: Camada de dados — cache (`data/cache.js`) e executor BigQuery (`data/bq.js`)

**Files:**
- Create: `server/data/cache.js`
- Create: `server/data/bq.js`
- Test: `test/cache.test.js`

**Interfaces:**
- Produces:
  - `cached(key: string, ttlMs: number, fn: () => Promise<T>) -> Promise<T>` e `limparCache()`
  - `runQuery(sql: string, params?: Array<{name,type,value}>) -> Promise<object[]>` (executa `bq query --format=json`)

- [ ] **Step 1: Escrever o teste que falha (cache)** — `test/cache.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached, limparCache } from '../server/data/cache.js';

test('cache reaproveita resultado dentro do TTL', async () => {
  limparCache();
  let chamadas = 0;
  const fn = async () => { chamadas++; return 42; };
  const a = await cached('k', 10_000, fn);
  const b = await cached('k', 10_000, fn);
  assert.equal(a, 42);
  assert.equal(b, 42);
  assert.equal(chamadas, 1);
});

test('cache expira após TTL', async () => {
  limparCache();
  let chamadas = 0;
  const fn = async () => { chamadas++; return chamadas; };
  await cached('k', 0, fn);
  await new Promise((r) => setTimeout(r, 1));
  await cached('k', 0, fn);
  assert.equal(chamadas, 2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/cache.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/data/cache.js`**

```js
const store = new Map();

export function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.t < ttlMs) return hit.p;
  const p = Promise.resolve().then(fn).catch((e) => { store.delete(key); throw e; });
  store.set(key, { t: now, p });
  return p;
}

export function limparCache() {
  store.clear();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/cache.test.js`
Expected: PASS.

- [ ] **Step 5: Implementar `server/data/bq.js`** (I/O — validado ao vivo na Task 10)

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);
const BQ = process.platform === 'win32' ? 'bq.cmd' : 'bq';

export async function runQuery(sql, params = []) {
  const args = [
    'query', '--quiet', '--format=json',
    '--use_legacy_sql=false', '--max_rows=1000000',
  ];
  for (const p of params) args.push(`--parameter=${p.name}:${p.type}:${p.value}`);
  args.push(sql);
  const { stdout } = await pexec(BQ, args, { maxBuffer: 128 * 1024 * 1024 });
  const txt = stdout.trim();
  return txt ? JSON.parse(txt) : [];
}
```

- [ ] **Step 6: Commit**

```bash
git add server/data/cache.js server/data/bq.js test/cache.test.js
git commit -m "feat: cache em memoria e executor de queries do BigQuery"
```

---

### Task 8: Camada de dados — queries, dados de exemplo e repositório (`data/queries.js`, `data/exemplo.js`, `data/repository.js`)

**Files:**
- Create: `server/data/queries.js`
- Create: `server/data/exemplo.js`
- Create: `server/data/repository.js`
- Test: `test/repository.test.js`

**Interfaces:**
- Consumes: `runQuery` (Task 7, injetável), domínio (Tasks 5–6), `cached`/`limparCache` (Task 7), `slug` (Task 2), `config` (Task 1).
- Produces:
  - `carregarTudo(deps: { runQuery }) -> Promise<LeadEnriquecido[]>`
  - `listarEventos(deps) -> Promise<Array<{ evento, slug, total, vendas, valorTotal, atendidos, pctAtendido, taxaConversao, instrutores: string[] }>>`
  - `detalheEvento(eventoSlug: string, deps) -> Promise<{ evento, resumo, instrutores, colunas } | { evento: null }>`

- [ ] **Step 1: Criar `server/data/queries.js`**

```js
export const SQL_LEADS = `
SELECT Nome, Email, Telefone, IdContato, PipelineId, PipelineName, EtapaId, EtapaName, Conexao
FROM \`leads-ts.hub_uni.info_leads\`
`;

export const SQL_VENDAS = `
SELECT person_phone, person_email, curso_comprado, valor_pago,
       CAST(data_venda_brt AS STRING) AS data_venda, Equipe
FROM (
  SELECT person_phone, person_email, curso_comprado, valor_pago, data_venda_brt, Equipe,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(person_id, 0) ORDER BY data_venda_brt DESC) rn
  FROM \`leads-ts.pipedrive_rt.vw_ald_trb_gold\`
  WHERE COALESCE(is_cancelled_flag, false) = false
)
WHERE rn = 1
`;
```

- [ ] **Step 2: Criar `server/data/exemplo.js`** (fixtures para desenvolver a UI com a view vazia — 2 eventos, 4 instrutores, várias etapas, algumas vendas)

```js
export const leadsExemplo = [
  // Evento CXJ 3006
  { Nome: 'Hérika Rodrigues', Email: 'herika@ex.com', Telefone: '5549998033100', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '1', EtapaName: 'Novo', Conexao: 'Presencial Elidiano' },
  { Nome: 'Marcos Silva', Email: 'marcos@ex.com', Telefone: '5511990000001', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Elidiano' },
  { Nome: 'Paula Souza', Email: 'paula@ex.com', Telefone: '5511990000002', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Elidiano' },
  { Nome: 'João Pedro', Email: 'joaop@ex.com', Telefone: '5511990000003', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '3', EtapaName: 'Convertido', Conexao: 'Presencial Elidiano' },
  { Nome: 'Ana Clara', Email: 'anaclara@ex.com', Telefone: '5511990000004', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '1', EtapaName: 'Novo', Conexao: 'Online Marina' },
  { Nome: 'Rafael Dias', Email: 'rafael@ex.com', Telefone: '5511990000005', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '4', EtapaName: 'Não atendeu', Conexao: 'Online Marina' },
  { Nome: 'Bruna Reis', Email: 'bruna@ex.com', Telefone: '5511990000006', PipelineId: '1', PipelineName: 'CXJ 3006', EtapaId: '3', EtapaName: 'Convertido', Conexao: 'Online Marina' },
  // Evento SP 4010
  { Nome: 'Carlos Nunes', Email: 'carlos@ex.com', Telefone: '5521990000010', PipelineId: '2', PipelineName: 'SP 4010', EtapaId: '1', EtapaName: 'Novo', Conexao: 'Presencial Diego' },
  { Nome: 'Fernanda Lima', Email: 'fernanda@ex.com', Telefone: '5521990000011', PipelineId: '2', PipelineName: 'SP 4010', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Diego' },
  { Nome: 'Lucas Gomes', Email: 'lucas@ex.com', Telefone: '5521990000012', PipelineId: '2', PipelineName: 'SP 4010', EtapaId: '3', EtapaName: 'Convertido', Conexao: 'Presencial Diego' },
  { Nome: 'Patrícia Alves', Email: 'patricia@ex.com', Telefone: '5521990000013', PipelineId: '2', PipelineName: 'SP 4010', EtapaId: '2', EtapaName: 'Em contato', Conexao: 'Presencial Helena' },
  { Nome: 'Roberto Farias', Email: 'roberto@ex.com', Telefone: '5521990000014', PipelineId: '2', PipelineName: 'SP 4010', EtapaId: '4', EtapaName: 'Não atendeu', Conexao: 'Presencial Helena' },
];

export const vendasExemplo = [
  { person_phone: '5549998033100', person_email: 'herika@ex.com', curso_comprado: 'Mentoria Ouro', valor_pago: 4970, data_venda: '2026-08-05', Equipe: 'Bruno Novak' },
  { person_phone: '5511990000003', person_email: 'joaop@ex.com', curso_comprado: 'Curso Base', valor_pago: 1997, data_venda: '2026-08-06', Equipe: 'Bruno Novak' },
  { person_phone: '5511990000006', person_email: 'bruna@ex.com', curso_comprado: 'Curso Base', valor_pago: 1997, data_venda: '2026-08-07', Equipe: 'Lucas Cristiano' },
  { person_phone: '5521990000012', person_email: 'lucas@ex.com', curso_comprado: 'Mentoria Ouro', valor_pago: 4970, data_venda: '2026-08-08', Equipe: 'Ana Paula' },
];
```

- [ ] **Step 3: Escrever o teste que falha (repositório com runQuery fake)** — `test/repository.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarEventos, detalheEvento } from '../server/data/repository.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, vendasExemplo } from '../server/data/exemplo.js';

function fakeDeps() {
  return {
    runQuery: async (sql) =>
      sql.includes('info_leads') ? leadsExemplo : vendasExemplo,
  };
}

test('listarEventos agrupa por PipelineName com métricas', async () => {
  limparCache();
  const eventos = await listarEventos(fakeDeps());
  const nomes = eventos.map((e) => e.evento).sort();
  assert.deepEqual(nomes, ['CXJ 3006', 'SP 4010']);
  const cxj = eventos.find((e) => e.evento === 'CXJ 3006');
  assert.equal(cxj.total, 7);
  assert.equal(cxj.vendas, 2);
});

test('detalheEvento traz instrutores e colunas', async () => {
  limparCache();
  const d = await detalheEvento('cxj-3006', fakeDeps());
  assert.equal(d.evento, 'CXJ 3006');
  assert.ok(d.instrutores.length >= 2);
  assert.ok(d.colunas.length >= 3);
});

test('detalheEvento inexistente retorna evento null', async () => {
  limparCache();
  const d = await detalheEvento('nao-existe', fakeDeps());
  assert.equal(d.evento, null);
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `node --test test/repository.test.js`
Expected: FAIL.

- [ ] **Step 5: Implementar `server/data/repository.js`**

```js
import { SQL_LEADS, SQL_VENDAS } from './queries.js';
import { leadsExemplo, vendasExemplo } from './exemplo.js';
import { cached } from './cache.js';
import { config } from '../../config.js';
import { indexarVendas } from '../domain/vendas.js';
import { enriquecerLeads, resumoEvento, resumoInstrutores } from '../domain/metricas.js';
import { montarColunas } from '../domain/kanban.js';
import { slug } from '../domain/texto.js';

export async function carregarTudo(deps) {
  if (config.usarExemplo) {
    return enriquecerLeads(leadsExemplo, indexarVendas(vendasExemplo));
  }
  return cached('leads-enriquecidos', config.cacheTtlMs, async () => {
    const [leadsRaw, vendasRaw] = await Promise.all([
      deps.runQuery(SQL_LEADS),
      deps.runQuery(SQL_VENDAS),
    ]);
    return enriquecerLeads(leadsRaw, indexarVendas(vendasRaw));
  });
}

function agruparPorEvento(leads) {
  const grupos = new Map();
  for (const l of leads) {
    if (!grupos.has(l.evento)) grupos.set(l.evento, []);
    grupos.get(l.evento).push(l);
  }
  return grupos;
}

export async function listarEventos(deps) {
  const leads = await carregarTudo(deps);
  return [...agruparPorEvento(leads).entries()]
    .map(([evento, ls]) => ({
      evento, slug: slug(evento),
      ...resumoEvento(ls),
      instrutores: [...new Set(ls.map((l) => l.instrutor))],
    }))
    .sort((a, b) => b.total - a.total);
}

export async function detalheEvento(eventoSlug, deps) {
  const leads = await carregarTudo(deps);
  const doEvento = leads.filter((l) => slug(l.evento) === eventoSlug);
  if (doEvento.length === 0) return { evento: null };
  return {
    evento: doEvento[0].evento,
    resumo: resumoEvento(doEvento),
    instrutores: resumoInstrutores(doEvento),
    colunas: montarColunas(doEvento),
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test test/repository.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/data/queries.js server/data/exemplo.js server/data/repository.js test/repository.test.js
git commit -m "feat: repositorio (eventos/detalhe) com queries e dados de exemplo"
```

---

### Task 9: API — rotas de eventos (`server/routes.js`, atualizar `server/app.js`)

**Files:**
- Create: `server/routes.js`
- Modify: `server/app.js` (montar as rotas de negócio)
- Test: `test/routes.test.js`

**Interfaces:**
- Consumes: `repository` (Task 8), `runQuery` (Task 7).
- Produces: `criarRotas(deps) -> express.Router` com `GET /health`, `GET /eventos`, `GET /eventos/:slug`. `criarApp(deps?)` passa a montar essas rotas em `/api`.

- [ ] **Step 1: Escrever o teste que falha** — `test/routes.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../server/app.js';
import { limparCache } from '../server/data/cache.js';
import { leadsExemplo, vendasExemplo } from '../server/data/exemplo.js';

function subir() {
  limparCache();
  const deps = { runQuery: async (sql) => sql.includes('info_leads') ? leadsExemplo : vendasExemplo };
  const app = criarApp(deps);
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve({ srv, base: `http://localhost:${srv.address().port}` }));
  });
}

test('GET /api/eventos retorna lista', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body) && body.length === 2);
  srv.close();
});

test('GET /api/eventos/:slug retorna detalhe', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos/cxj-3006`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.evento, 'CXJ 3006');
  srv.close();
});

test('GET /api/eventos/:slug inexistente retorna 404', async () => {
  const { srv, base } = await subir();
  const res = await fetch(`${base}/api/eventos/nao-existe`);
  assert.equal(res.status, 404);
  srv.close();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/routes.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `server/routes.js`**

```js
import { Router } from 'express';
import * as repo from './data/repository.js';
import { runQuery } from './data/bq.js';

export function criarRotas(deps = { runQuery }) {
  const r = Router();
  r.get('/health', (_req, res) => res.json({ ok: true }));
  r.get('/eventos', async (_req, res, next) => {
    try { res.json(await repo.listarEventos(deps)); } catch (e) { next(e); }
  });
  r.get('/eventos/:slug', async (req, res, next) => {
    try {
      const d = await repo.detalheEvento(req.params.slug, deps);
      if (!d.evento) return res.status(404).json({ erro: 'Evento não encontrado' });
      res.json(d);
    } catch (e) { next(e); }
  });
  return r;
}
```

- [ ] **Step 4: Atualizar `server/app.js`** para montar as rotas e injetar deps

```js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './routes.js';
import { runQuery } from './data/bq.js';

export function criarApp(deps = { runQuery }) {
  const app = express();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  app.use('/api', criarRotas(deps));
  app.use(express.static(path.join(dir, '..', 'frontend')));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ erro: 'Falha ao consultar os dados' });
  });
  return app;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test test/routes.test.js`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 7: Commit**

```bash
git add server/routes.js server/app.js test/routes.test.js
git commit -m "feat: rotas da API de eventos com injecao de dependencias"
```

---

### Task 10: Integração ao vivo com o BigQuery

**Files:**
- Modify (se necessário p/ Windows): `server/data/bq.js`

**Interfaces:**
- Nenhuma nova. Valida que `runQuery` funciona contra o BigQuery real e que a view vazia não quebra.

- [ ] **Step 1: Subir o servidor sem dados de exemplo**

Run (background): `npm start`
(Não definir `USAR_EXEMPLO`.)

- [ ] **Step 2: Bater a API ao vivo**

Run: `curl -s http://localhost:3000/api/eventos`
Expected: `[]` se a view de leads estiver vazia (sem erro/stacktrace), ou a lista real se houver dados. Se der erro de spawn do `bq` no Windows, aplicar o Step 3.

- [ ] **Step 3 (condicional): Corrigir invocação do `bq` no Windows**

Se `bq.cmd` não for encontrado por `execFile`, trocar a chamada em `server/data/bq.js` para usar `shell: true`:

```js
const { stdout } = await pexec(BQ, args, { maxBuffer: 128 * 1024 * 1024, shell: true, windowsHide: true });
```

Se ainda falhar, resolver o caminho absoluto via `where bq` uma vez e usá-lo. Re-testar o Step 2.

- [ ] **Step 4: Validar o health ao vivo**

Run: `curl -s http://localhost:3000/api/health`
Expected: `{"ok":true}`. Parar o servidor.

- [ ] **Step 5: Commit (se houve ajuste)**

```bash
git add server/data/bq.js
git commit -m "fix: invocacao do bq CLI no Windows"
```

---

### Task 11: Frontend — base visual e home (grade de eventos)

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/styles.css`
- Create: `frontend/app.js`

**Interfaces:**
- Consumes: `GET /api/eventos`.
- Produces: SPA com roteamento por hash (`#/` = home, `#/evento/:slug` = detalhe na Task 12). Home renderiza cards de evento.

- [ ] **Step 1: Escrever `frontend/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hub do Palestrante</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topo">
    <a class="marca" href="#/">Hub do Palestrante</a>
    <span class="sub">TradeStars</span>
  </header>
  <main id="app" class="conteudo"></main>
  <script src="/app.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Escrever `frontend/styles.css`** (tema sóbrio/premium, claro+escuro, base de layout, cards)

```css
:root {
  --bg: #f5f6f8; --surface: #ffffff; --texto: #14181f; --suave: #667085;
  --borda: #e5e8ee; --acento: #2f5bea; --venda: #17a673; --sombra: 0 1px 3px rgba(16,24,40,.08), 0 1px 2px rgba(16,24,40,.04);
  --raio: 14px;
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#0e1116; --surface:#161b22; --texto:#e6edf3; --suave:#9aa4b2; --borda:#232a33; --acento:#5b82ff; --venda:#2fd39b; --sombra:0 1px 2px rgba(0,0,0,.4); }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--texto);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.topo { display:flex; align-items:baseline; gap:12px; padding:18px 28px; border-bottom:1px solid var(--borda); background:var(--surface); position:sticky; top:0; z-index:10; }
.marca { font-weight:700; font-size:18px; letter-spacing:-.01em; color:var(--texto); text-decoration:none; }
.sub { color:var(--suave); font-size:13px; text-transform:uppercase; letter-spacing:.08em; }
.conteudo { max-width:1200px; margin:0 auto; padding:28px; }
.titulo-secao { font-size:14px; text-transform:uppercase; letter-spacing:.08em; color:var(--suave); margin:0 0 16px; }
.grade { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:18px; }
.card-evento { display:block; text-decoration:none; color:inherit; background:var(--surface); border:1px solid var(--borda); border-radius:var(--raio); padding:20px; box-shadow:var(--sombra); transition:transform .15s ease, box-shadow .15s ease; }
.card-evento:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(16,24,40,.12); }
.card-evento h3 { margin:0 0 14px; font-size:18px; letter-spacing:-.01em; }
.metricas { display:flex; gap:18px; }
.metrica .n { font-size:22px; font-weight:700; }
.metrica .l { font-size:12px; color:var(--suave); }
.pill-venda { color:var(--venda); font-weight:600; }
.vazio { text-align:center; color:var(--suave); padding:64px 0; }
.carregando { color:var(--suave); padding:32px 0; }
```

- [ ] **Step 3: Escrever `frontend/app.js`** (roteador por hash + home; detalhe fica como stub para a Task 12)

```js
const app = document.getElementById('app');
const moeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function metrica(n, l) {
  return `<div class="metrica"><div class="n">${n}</div><div class="l">${l}</div></div>`;
}

async function telaHome() {
  app.innerHTML = `<p class="carregando">Carregando eventos…</p>`;
  let eventos;
  try { eventos = await getJSON('/api/eventos'); }
  catch { app.innerHTML = `<p class="vazio">Não foi possível carregar os eventos.</p>`; return; }
  if (!eventos.length) {
    app.innerHTML = `<p class="vazio">Nenhum evento ainda. Assim que os leads caírem, eles aparecem aqui.</p>`;
    return;
  }
  app.innerHTML = `
    <h2 class="titulo-secao">Eventos</h2>
    <div class="grade">
      ${eventos.map((e) => `
        <a class="card-evento" href="#/evento/${e.slug}">
          <h3>${e.evento}</h3>
          <div class="metricas">
            ${metrica(e.total, 'leads')}
            ${metrica(e.vendas, 'vendas')}
            ${metrica(`<span class="pill-venda">${moeda(e.valorTotal)}</span>`, 'gerado')}
          </div>
        </a>`).join('')}
    </div>`;
}

async function telaDetalhe(_slug) {
  app.innerHTML = `<p class="carregando">Detalhe do evento (Task 12).</p>`;
}

function rotear() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/evento\/(.+)$/);
  if (m) telaDetalhe(decodeURIComponent(m[1]));
  else telaHome();
}

window.addEventListener('hashchange', rotear);
rotear();
```

- [ ] **Step 4: Verificação visual (home com dados de exemplo)**

Run (background): `USAR_EXEMPLO=1 npm start` (no PowerShell: `$env:USAR_EXEMPLO=1; npm start`)
Abrir `http://localhost:3000` no navegador (usar as ferramentas de Browser). Confirmar: dois cards ("CXJ 3006" e "SP 4010"), com nº de leads, vendas e valor gerado; hover eleva o card; tema respeita claro/escuro do sistema. Parar o servidor.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/styles.css frontend/app.js
git commit -m "feat: home com grade de eventos e base visual sobria"
```

---

### Task 12: Frontend — detalhe do evento (instrutores em P&B + kanban + selo de venda + filtros)

**Files:**
- Modify: `frontend/app.js` (implementar `telaDetalhe`)
- Modify: `frontend/styles.css` (estilos de instrutor, kanban, cards de lead, selo)

**Interfaces:**
- Consumes: `GET /api/eventos/:slug` (retorna `{ evento, resumo, instrutores, colunas }`).

- [ ] **Step 1: Acrescentar estilos ao `frontend/styles.css`**

```css
.voltar { color:var(--suave); text-decoration:none; font-size:14px; }
.cabecalho-evento { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin:12px 0 20px; }
.cabecalho-evento h2 { margin:0; font-size:26px; letter-spacing:-.02em; }
.faixa-instrutores { display:flex; gap:16px; overflow-x:auto; padding-bottom:8px; margin-bottom:24px; }
.instrutor { flex:0 0 auto; width:150px; background:var(--surface); border:1px solid var(--borda); border-radius:var(--raio); padding:14px; text-align:center; box-shadow:var(--sombra); cursor:pointer; transition:border-color .15s; }
.instrutor.ativo { border-color:var(--acento); }
.instrutor .foto { width:84px; height:84px; border-radius:50%; object-fit:cover; margin:0 auto 10px; display:block; filter:grayscale(1); transition:filter .2s ease; background:var(--bg); }
.instrutor:hover .foto { filter:grayscale(0); }
.avatar-iniciais { width:84px; height:84px; border-radius:50%; margin:0 auto 10px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:26px; color:#fff; background:linear-gradient(135deg,#8892a6,#5b6577); filter:grayscale(1); transition:filter .2s; }
.instrutor:hover .avatar-iniciais { filter:grayscale(0); }
.instrutor .nome { font-weight:600; font-size:14px; }
.instrutor .mini { font-size:12px; color:var(--suave); margin-top:4px; }
.filtros { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.filtros button { border:1px solid var(--borda); background:var(--surface); color:var(--texto); padding:7px 12px; border-radius:999px; font-size:13px; cursor:pointer; }
.filtros button.on { background:var(--acento); border-color:var(--acento); color:#fff; }
.kanban { display:flex; gap:16px; overflow-x:auto; padding-bottom:12px; }
.coluna { flex:0 0 280px; background:var(--surface); border:1px solid var(--borda); border-radius:var(--raio); padding:12px; }
.coluna h4 { margin:2px 4px 12px; font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--suave); display:flex; justify-content:space-between; }
.card-lead { background:var(--bg); border:1px solid var(--borda); border-radius:10px; padding:10px 12px; margin-bottom:10px; }
.card-lead .ln { font-weight:600; font-size:14px; }
.card-lead .lt { font-size:12px; color:var(--suave); margin-top:2px; }
.selo { display:inline-block; margin-top:8px; font-size:11px; font-weight:700; color:#fff; background:var(--venda); padding:3px 8px; border-radius:999px; }
.selo small { font-weight:500; opacity:.9; }
```

- [ ] **Step 2: Implementar `telaDetalhe` em `frontend/app.js`** (substituir o stub)

```js
function iniciais(nome) {
  return nome.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function fotoInstrutor(ins) {
  const src = `/public/instrutores/${ins.slug}.jpg`;
  return `<img class="foto" src="${src}" alt="${ins.instrutor}"
    onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-iniciais',textContent:'${iniciais(ins.instrutor)}'}))">`;
}

function cardLead(l) {
  const selo = l.vendeu
    ? `<div class="selo">VENDEU <small>· ${l.curso ?? ''} ${l.valorPago ? '· ' + moeda(l.valorPago) : ''}</small></div>`
    : '';
  return `<div class="card-lead" data-instrutor="${l.instrutorSlug}">
    <div class="ln">${l.nome}</div>
    <div class="lt">${l.telefone || 'sem telefone'}</div>
    ${selo}
  </div>`;
}

let estado = { detalhe: null, filtroInstrutor: null };

function renderKanban() {
  const d = estado.detalhe;
  const filtro = estado.filtroInstrutor;
  const cols = d.colunas.map((c) => {
    const leads = filtro ? c.leads.filter((l) => l.instrutorSlug === filtro) : c.leads;
    return `<div class="coluna">
      <h4><span>${c.etapaName}</span><span>${leads.length}</span></h4>
      ${leads.map(cardLead).join('') || '<div class="lt" style="padding:6px 4px">—</div>'}
    </div>`;
  }).join('');
  document.getElementById('kanban').innerHTML = cols;
  document.querySelectorAll('.instrutor').forEach((el) => {
    el.classList.toggle('ativo', el.dataset.slug === filtro);
  });
}

async function telaDetalhe(slug) {
  app.innerHTML = `<p class="carregando">Carregando evento…</p>`;
  let d;
  try { d = await getJSON(`/api/eventos/${slug}`); }
  catch { app.innerHTML = `<p class="vazio">Evento não encontrado. <a href="#/">Voltar</a></p>`; return; }
  estado = { detalhe: d, filtroInstrutor: null };

  app.innerHTML = `
    <a class="voltar" href="#/">← Eventos</a>
    <div class="cabecalho-evento">
      <h2>${d.evento}</h2>
      <div class="metricas">
        ${metrica(d.resumo.total, 'leads')}
        ${metrica(d.resumo.vendas, 'vendas')}
        ${metrica(`<span class="pill-venda">${moeda(d.resumo.valorTotal)}</span>`, 'gerado')}
      </div>
    </div>
    <div class="faixa-instrutores">
      ${d.instrutores.map((ins) => `
        <div class="instrutor" data-slug="${ins.slug}">
          ${fotoInstrutor(ins)}
          <div class="nome">${ins.instrutor}</div>
          <div class="mini">${ins.total} leads · ${ins.vendas} vendas</div>
        </div>`).join('')}
    </div>
    <div class="filtros">
      <button id="ftodos" class="on">Todos</button>
      <span class="lt">clique num instrutor para filtrar</span>
    </div>
    <div id="kanban" class="kanban"></div>`;

  document.querySelectorAll('.instrutor').forEach((el) => {
    el.addEventListener('click', () => {
      estado.filtroInstrutor = estado.filtroInstrutor === el.dataset.slug ? null : el.dataset.slug;
      document.getElementById('ftodos').classList.toggle('on', !estado.filtroInstrutor);
      renderKanban();
    });
  });
  document.getElementById('ftodos').addEventListener('click', () => {
    estado.filtroInstrutor = null;
    document.getElementById('ftodos').classList.add('on');
    renderKanban();
  });
  renderKanban();
}
```

- [ ] **Step 3: Verificação visual (detalhe com dados de exemplo)**

Run (background): `$env:USAR_EXEMPLO=1; npm start`
Abrir `http://localhost:3000/#/evento/cxj-3006`. Confirmar:
- Faixa de instrutores com avatares de iniciais em **preto e branco**, ganhando cor no hover.
- Kanban com colunas Novo → Em contato → Convertido → Não atendeu, cards de lead com nome/telefone.
- Selo verde **VENDEU** com curso e valor nos leads que têm venda (ex.: Hérika, João Pedro).
- Clicar num instrutor filtra os cards do kanban; "Todos" limpa o filtro.
Parar o servidor.

- [ ] **Step 4: Commit**

```bash
git add frontend/app.js frontend/styles.css
git commit -m "feat: detalhe do evento com instrutores, kanban e selo de venda"
```

---

### Task 13: Fotos dos instrutores, estados vazios/erro e responsivido (acabamento)

**Files:**
- Create: `frontend/public/instrutores/.gitkeep`
- Create: `frontend/public/instrutores/README.md`
- Modify: `frontend/styles.css` (responsivo)
- Modify: `server/data/bq.js` (mensagem de erro amigável, se aplicável)

**Interfaces:**
- Nenhuma nova. Fecha estados de borda e a convenção de fotos.

- [ ] **Step 1: Criar a pasta de fotos e o guia**

Create `frontend/public/instrutores/.gitkeep` (vazio).
Create `frontend/public/instrutores/README.md`:

```markdown
# Fotos dos instrutores

Coloque aqui a foto de cada instrutor como `<slug>.jpg`, onde `<slug>` é o nome
em minúsculas, sem acento e com hífens no lugar de espaços.

Exemplos:
- Instrutor "Elidiano" → `elidiano.jpg`
- Instrutor "Ana Paula" → `ana-paula.jpg`

As fotos são exibidas em preto e branco e ganham cor ao passar o mouse.
Quem não tiver foto aparece com um avatar de iniciais automático.
```

- [ ] **Step 2: Responsividade — acrescentar ao `frontend/styles.css`**

```css
@media (max-width: 640px) {
  .conteudo { padding:18px; }
  .topo { padding:14px 18px; }
  .cabecalho-evento { flex-direction:column; align-items:flex-start; }
  .coluna { flex-basis:82vw; }
}
```

- [ ] **Step 3: Verificar estado vazio ao vivo (view sem leads)**

Run (background): `npm start` (sem `USAR_EXEMPLO`).
Abrir `http://localhost:3000`. Confirmar a mensagem "Nenhum evento ainda…" sem erros no console do navegador. Parar o servidor.

- [ ] **Step 4: Verificar responsividade**

Com `$env:USAR_EXEMPLO=1; npm start`, abrir a home e o detalhe e reduzir a largura (viewport mobile). Confirmar que a grade colapsa, o kanban rola horizontalmente e nada estoura a largura da página.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/instrutores/ frontend/styles.css server/data/bq.js
git commit -m "feat: fotos dos instrutores, estados vazios e responsividade"
```

---

## Self-Review (feita ao escrever o plano)

**Cobertura do spec:**
- §2 Fontes de dados → Tasks 7, 8 (queries e executor). ✔
- §3.1 Evento = PipelineName → Task 8 (`agruparPorEvento`). ✔
- §3.2 Instrutor via Conexao → Task 3. ✔
- §3.3 Kanban data-driven por EtapaName/EtapaId → Task 4. ✔
- §3.4 Vendeu/não vendeu por telefone+e-mail, ignora cancelados → Tasks 5 (cruzamento) e 8 (SQL `is_cancelled_flag`). ✔
- §3.5 Instrutor × vendedor configurável → capturado como campo `vendedor` + filtro por instrutor no kanban (Task 12); a marcação definitiva fica isolada no domínio para cravar com dados reais. ✔ (o toggle "repassado ao vendedor" completo depende dos dados reais; MVP entrega o filtro por instrutor)
- §4 Arquitetura em 3 camadas → Tasks 2–9. ✔
- §5 Telas (home + detalhe) → Tasks 11, 12. ✔
- §6 Visual sóbrio/premium (claro+escuro, grayscale, micro-animações) → Tasks 11–13. ✔
- §7 Fotos + avatar de iniciais → Tasks 12, 13. ✔
- §9 View vazia / riscos → Tasks 10, 13 (estados vazios); exemplos p/ desenvolver → Task 8. ✔

**Placeholders:** nenhum passo com "TBD/TODO"; todo código está escrito. ✔
**Consistência de tipos:** `runQuery`, `cached/limparCache`, `enriquecerLeads`, `resumoEvento`, `resumoInstrutores`, `montarColunas`, `indexarVendas/cruzarLead`, `slug`, `parseConexao`, `criarApp/criarRotas` usados com as mesmas assinaturas entre as tasks. ✔

**Observação de escopo:** o toggle completo "atendidos pelo instrutor × repassados ao vendedor" (§5.2) depende da marcação real nos dados, ainda desconhecida. O MVP entrega o filtro por instrutor no kanban e deixa o campo `vendedor` pronto; a regra definitiva será um ajuste pequeno e localizado quando os dados reais chegarem.
