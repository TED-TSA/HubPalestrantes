# Login por instrutor + interface black — Design / Spec

**Data:** 2026-08-12
**Empresa:** TradeStars
**Autor:** bi03@tradestars.com.br + Claude
**Altera:** `2026-08-11-hub-palestrante-design.md` (que colocava login fora de escopo, seção 8)

---

## 1. Objetivo

Hoje o Hub é aberto: qualquer pessoa com o link vê todos os eventos e todos os leads. Esta
entrega fecha o acesso e personaliza a experiência:

- Cada instrutor tem seu login (`@tradestars.com.br`) e vê **apenas os eventos e leads dele**.
- Um perfil **admin** mantém a visão global de hoje e cadastra os instrutores pela interface.
- A interface passa a ser **black fixa**, com tela de login cinematográfica (vídeo de fundo).

---

## 2. Decisões tomadas

| Tema | Decisão | Alternativa descartada |
|---|---|---|
| Autenticação | Senha própria do Hub, hash `scrypt` | Google Workspace (exige OAuth client + URL fixa); link mágico (exige SMTP) |
| Perfis | `instrutor` e `admin` | Só instrutor (perderia a visão gerencial) |
| Cadastro | Tela de admin no próprio Hub | Arquivo no repo; tabela no BigQuery |
| Persistência | SQLite via `node:sqlite` (`hub.db`) | JSON em disco (corrompe); BigQuery (warehouse não é base transacional) |
| Vínculo instrutor↔dados | Escolha guiada pelos `Conexao` reais | Texto livre (erro de grafia); deduzir do email (quebra em nome composto) |
| Tema | Black fixo no app inteiro | Só o login; black com toggle de claro |
| Vídeo do login | Vídeo no desktop, imagem estática no celular | Vídeo sempre (dados + autoplay do iOS) |
| Visibilidade | Instrutor vê só os leads dele | Ver o evento todo; ver só o total do evento |

---

## 3. O que **não** muda

A leitura do BigQuery (`server/data/bq.js`, `queries.js`), o cache e todo o domínio
(`metricas.js`, `kanban.js`, `vendas.js`, `instrutor.js`) permanecem como estão. O parse do
`Conexao` continua sendo a única fonte do nome do instrutor.

---

## 4. Persistência — `hub.db`

Arquivo SQLite criado sozinho na primeira subida, via `node:sqlite` (nativo no Node 25; emite
`ExperimentalWarning`). Entra no `.gitignore` — é dado de acesso, não código.

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,          -- obrigatoriamente @tradestars.com.br
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,            -- scrypt, salt por usuário
  papel TEXT NOT NULL,                 -- 'instrutor' | 'admin'
  ativo INTEGER NOT NULL DEFAULT 1,
  precisa_trocar_senha INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE vinculos (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome_conexao TEXT NOT NULL UNIQUE    -- ex.: 'Elidiano'
);

CREATE TABLE sessoes (
  id TEXT PRIMARY KEY,                 -- token aleatório de 32 bytes
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL
);
```

`vinculos` é tabela separada para que um instrutor possa ser dono de **várias grafias** do nome
sem duplicar o cadastro. O `UNIQUE` em `nome_conexao` impede que dois instrutores disputem o
mesmo nome.

### 4.1 Primeiro admin

`npm run criar-admin` pede email e senha e grava direto no banco. Sem isso haveria o problema do
ovo e da galinha: a tela de cadastro exige estar logado como admin.

---

## 5. Autenticação — `server/auth/`

Sem dependência nova.

- **`senha.js`** — `scrypt` do `node:crypto`, salt aleatório por usuário, comparação em tempo
  constante (`timingSafeEqual`).
- **`sessao.js`** — token de 32 bytes (`randomBytes`), gravado em `sessoes`, devolvido em cookie
  `httpOnly` + `SameSite=Lax` + `Path=/`. Expira em **12h**, renovado a cada requisição válida.
  O header `Cookie` é lido na mão (poucas linhas), evitando puxar `cookie-parser`.
- **`middleware.js`** — `exigirLogin` e `exigirAdmin`. Toda rota `/api` exige sessão, exceto
  `POST /api/login`.
- **Limite de tentativas** — contador em memória por `email+IP`; após 5 falhas, bloqueia aquele
  par por 5 minutos. Suficiente para uma ferramenta interna; não pretende ser antifraude.

---

## 6. Autorização — o filtro mora na camada de dados

**Ponto central do desenho.** `listarEventos()` e `detalheEvento()` passam a receber o usuário e
filtram os leads **antes de virar JSON**:

- `papel = 'admin'` → nenhum filtro, comportamento de hoje.
- `papel = 'instrutor'` → só leads cujo instrutor parseado esteja nos `vinculos` dele.

Um instrutor logado nunca recebe pela rede um lead que não é dele. Se o filtro vivesse no
`frontend/app.js`, os dados dos colegas viajariam no payload e bastaria abrir a aba Network para
lê-los.

---

## 7. Telas

### 7.1 `/login`
Tela cheia, vídeo de fundo, card central com email e senha. A mensagem de erro é **sempre
genérica** ("email ou senha inválidos"), nunca distinguindo qual campo falhou — caso contrário a
tela vira um validador de quem trabalha na empresa. Primeiro acesso (`precisa_trocar_senha = 1`)
força a troca antes de liberar o app.

### 7.2 Home do instrutor
Apenas os eventos em que ele tem lead. Foto e nome dele no topo. Se não tiver nenhum evento, um
estado vazio explicando que ainda não há leads vinculados a ele — e não uma tela em branco.

### 7.3 Evento (instrutor)
Métricas do topo calculadas só sobre os leads dele. A faixa de instrutores desaparece (só existe
ele) e o kanban traz apenas os cards dele. O filtro por instrutor deixa de fazer sentido e sai.

### 7.4 Admin
Home global idêntica à de hoje, com a faixa de instrutores e o filtro preservados, mais um menu
**Instrutores**: listar, criar, editar, desativar e resetar senha. Inclui o **painel de nomes
órfãos** — valores de `Conexao` presentes no BigQuery que ainda não têm dono. É o que transforma
um erro silencioso (instrutor logando numa tela vazia) em algo visível.

### 7.5 Sair
Botão no topo; destrói a sessão no banco e limpa o cookie.

---

## 8. Visual — black

- Paleta **black fixa**: o bloco `@media (prefers-color-scheme: dark)` e as variáveis claras saem
  do `styles.css`. Fundo quase preto, superfícies elevadas por um tom, bordas sutis, texto
  off-white, um único acento. O verde do selo de venda permanece.
- Tipografia com mais peso e `letter-spacing` negativo nos números.
- Fotos seguem em grayscale ganhando cor no hover, como já são hoje.
- **Login:** `<video autoplay muted loop playsinline>` cobrindo a viewport, com overlay escuro
  para o formulário respirar. O atributo `poster` é o frame estático servido ao celular.
- Arquivos em `frontend/public/login/fundo.mp4` e `fundo.jpg`. **Enquanto não chegarem**, um
  gradiente escuro animado em CSS segura a tela sem parecer quebrada.

---

## 9. Testes (`node --test`, já configurado)

1. **O teste que importa:** instrutor A requisitando `GET /api/eventos/<slug-de-B>` recebe `404`
   (o evento simplesmente não existe para ele), e nenhum lead de B aparece em nenhum payload que
   A consiga obter.
2. Hash de senha: senha correta valida, senha errada não; hashes iguais geram salts diferentes.
3. `exigirLogin` e `exigirAdmin` barram quem não deve passar.
4. Parse do header `Cookie`.
5. Sessão expirada é rejeitada.
6. Cadastro recusa email fora de `@tradestars.com.br`.

---

## 10. Dependências externas pendentes

1. **Nomes e emails dos instrutores** — para o cadastro inicial.
2. **Vídeo de fundo do login** — `fundo.mp4` + um frame `fundo.jpg`.

Nenhum dos dois bloqueia a construção: o app sobe com o gradiente e com o admin vazio.

---

## 11. Riscos

1. **`info_leads` está com 0 linhas hoje.** A lista de nomes do cadastro nasce vazia, então o
   admin precisa aceitar digitação enquanto não houver dados — senão é impossível cadastrar
   qualquer instrutor agora.
2. **Grafia do `Conexao`.** Se o mesmo instrutor aparecer escrito de formas diferentes, cada
   variante precisa virar um vínculo. O painel de órfãos existe para expor isso.
3. **`node:sqlite` é experimental** nesta versão do Node. Funciona, mas a API pode mudar entre
   versões maiores.
4. **Senhas distribuídas na mão.** É o custo de não usar o Google Workspace. Se virar incômodo,
   migrar para "Entrar com Google" é a evolução natural e não muda o resto do desenho.

---

## 12. Fora de escopo

- Upload de foto pela tela de admin (o fluxo de largar o arquivo na pasta continua).
- Recuperação de senha por email (o admin reseta).
- Autenticação em dois fatores.
- Log de auditoria de acessos.
