const app = document.getElementById('app');
const menu = document.getElementById('menu');

let eu = null;
let estado = { detalhe: null, filtroInstrutor: null };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Os valores em R$ saíram da interface por decisão do produto. O backend ainda
// calcula valorTotal, então dá para trazer de volta mexendo só aqui.
const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const dd = (n) => String(n).padStart(2, '0');

async function pedir(url, opcoes = {}) {
  const res = await fetch(url, {
    headers: opcoes.body ? { 'content-type': 'application/json' } : {},
    ...opcoes,
  });
  if (res.status === 401) { location.href = '/login'; throw new Error('sem sessão'); }
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({}));
    throw new Error(corpo.erro ?? 'Não foi possível completar a ação.');
  }
  return res.json();
}

const ehAdmin = () => eu?.papel === 'admin';

// Nome de evento é sigla + número ("CXJ 3006"): a sigla identifica, o número é
// só sequência. O desenho separa os dois pesos.
function nomeEvento(nome) {
  const m = String(nome ?? '').trim().match(/^(\S+)\s+(.+)$/);
  return m ? { sigla: m[1], num: m[2] } : { sigla: String(nome ?? ''), num: '' };
}

function tituloEvento(nome, classe = 'ev-nome') {
  const { sigla, num } = nomeEvento(nome);
  return `<div class="${classe}">
    <span class="sigla">${esc(sigla)}</span>
    ${num ? `<span class="num">${esc(num)}</span>` : ''}
  </div>`;
}

function metrica(n, l) {
  return `<div class="metrica"><div class="n">${n}</div><div class="l">${l}</div></div>`;
}

function tituloLinha(texto, conta, extra = '') {
  return `<div class="titulo-linha">
    <h2 class="titulo-secao">${esc(texto)}</h2>
    ${conta !== undefined ? `<span class="titulo-conta">${esc(conta)}</span>` : ''}
    <span class="titulo-fio"></span>
    ${extra}
  </div>`;
}

function mascararEmail(email) {
  const s = String(email ?? '').trim();
  if (!s) return '';
  const [user, dominio] = s.split('@');
  if (!user) return s;
  const visivel = user.length > 3 ? user.slice(3) : '';
  return '•••' + visivel + (dominio ? '@' + dominio : '');
}

function mascararTelefone(tel) {
  const s = String(tel ?? '');
  if (s.length <= 4) return s;
  return s.slice(0, -4) + '••••';
}

function iniciais(nome) {
  return String(nome ?? '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

// Troca a <img> por um bloco de iniciais quando o arquivo não existe, mantendo
// a mesma classe para herdar o estilo. Feito com listener em vez de onerror
// inline para não injetar nome de gente em atributo.
function tratarFotosQuebradas(raiz = document) {
  raiz.querySelectorAll('img[data-iniciais]').forEach((img) => {
    img.addEventListener('error', () => {
      const span = document.createElement('span');
      span.className = img.className;
      // Leva o style junto: é nele que vai o clip-path da faixa diagonal.
      span.style.cssText = img.style.cssText;
      span.textContent = img.dataset.iniciais;
      img.replaceWith(span);
    }, { once: true });
  });
}

function foto(classe, slug, nome, extra = '') {
  return `<img class="${classe}" src="/public/instrutores/${esc(slug)}.jpg"
    alt="${esc(nome)}" data-iniciais="${esc(iniciais(nome))}" ${extra}>`;
}

// Quanto a aresta diagonal anda da direita para a esquerda, em % da área de
// foto. Quanto maior, mais inclinado o corte — e menos foto sobra. O recorte do
// invólucro sai daqui também, para o ângulo não viver escrito em dois lugares.
const CORTE = 30;

// Quem subiu ao palco naquele evento, cortado no próprio card em vez de num
// bloco à parte. Com mais de uma pessoa, a área diagonal é dividida em faixas
// paralelas. O teto é três: a quarta faixa cai para uns 30px de largura, e uma
// fatia dessas não deixa reconhecer ninguém — melhor resumir em "+N".
function elenco(instrutores) {
  if (!instrutores?.length) return '';
  const mostra = instrutores.slice(0, 3);
  const resto = instrutores.length - mostra.length;
  const n = mostra.length;

  // Altura em que o rosto costuma cair na foto, contada do topo.
  const ROSTO = 0.28;

  const faixas = mostra.map((ins, k) => {
    const t0 = CORTE + (k * (100 - CORTE)) / n;
    const t1 = CORTE + ((k + 1) * (100 - CORTE)) / n;
    const ultima = k === n - 1;

    // O recorte fica no invólucro, em coordenadas do card; a foto por dentro se
    // move livre. O 1px de folga nas arestas inclinadas é a fresta que deixa o
    // âmbar do fundo aparecer e vira o fio do corte.
    const recorte = ultima
      ? `polygon(calc(${t0}% + 1px) 0, 100% 0, 100% 100%, calc(${t0 - CORTE}% + 1px) 100%)`
      : `polygon(calc(${t0}% + 1px) 0, calc(${t1}% - 1px) 0, `
        + `calc(${t1 - CORTE}% - 1px) 100%, calc(${t0 - CORTE}% + 1px) 100%)`;

    // Onde o rosto precisa cair: o meio da faixa na altura dele. A última faixa
    // tem a borda direita reta em vez de inclinada, e por isso seu meio fica bem
    // mais à direita — foi o que partia o rosto do segundo instrutor ao meio.
    const alvo = ultima
      ? (t0 - CORTE * ROSTO + 100) / 2
      : (t0 + t1) / 2 - CORTE * ROSTO;

    // A foto é centrada nesse alvo e alargada o quanto for preciso para ainda
    // cobrir a faixa inteira, sem deixar canto descoberto.
    const limEsq = t0 - CORTE;
    const limDir = ultima ? 100 : t1;
    const esquerda = Math.min(limEsq, 2 * alvo - limDir);
    const largura = 2 * (alvo - esquerda);
    return { recorte, estilo: `left:${esquerda}%;width:${largura}%` };
  });

  return `<div class="elenco" style="clip-path:polygon(${CORTE}% 0, 100% 0, 100% 100%, 0 100%)">
    ${mostra.map((ins, k) => `<span class="faixa" style="clip-path:${faixas[k].recorte}"
       title="${esc(ins.instrutor)} · ${ins.total} leads · ${ins.vendas} vendas">
       ${foto('rosto', ins.slug, ins.instrutor, `style="${faixas[k].estilo}"`)}
     </span>`).join('')}
    ${resto > 0 ? `<span class="mais">+${resto}</span>` : ''}
  </div>`;
}

/* ---------------- Topo ---------------- */

function renderMenu() {
  const admin = ehAdmin();
  menu.innerHTML = `
    <div class="eu-quem">
      ${admin
        ? `<span class="eu-selo">${esc(iniciais(eu.nome))}</span>`
        : foto('eu-selo', eu.fotoSlug, eu.nome)}
      <span class="eu-nome">${esc(eu.nome)}</span>
      <span class="eu-papel">${admin ? 'Gestão' : 'Instrutor'}</span>
    </div>
    <span class="fio-vertical"></span>
    ${admin ? '<a class="link-topo" href="#/instrutores">Instrutores</a><span class="fio-vertical"></span>' : ''}
    <button class="link-topo" type="button" id="tema">${rotuloTema()}</button>
    <span class="fio-vertical"></span>
    <button class="link-topo" type="button" id="sair">Sair</button>`;
  tratarFotosQuebradas(menu);
  document.getElementById('tema').addEventListener('click', alternarTema);
  document.getElementById('sair').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
}

// O botão mostra o tema para onde vai, não o que está valendo.
const rotuloTema = () => (document.documentElement.dataset.tema === 'claro' ? 'Escuro' : 'Claro');

function alternarTema() {
  const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
  document.documentElement.dataset.tema = novo;
  localStorage.setItem('hub-tema', novo);
  document.getElementById('tema').textContent = rotuloTema();
}

/* ---------------- Home ---------------- */

function esqueleto() {
  return `<div class="esqueleto"><div></div><div></div><div></div></div>`;
}

async function telaHome() {
  app.innerHTML = tituloLinha(ehAdmin() ? 'Todos os eventos' : 'Seus eventos') + esqueleto();

  let eventos;
  try { eventos = await pedir('/api/eventos'); }
  catch {
    app.innerHTML = `<div class="vazio"><h3>Não foi possível carregar</h3>
      <p>A consulta aos dados falhou. Recarregue a página; se continuar, fale com o time de BI.</p></div>`;
    return;
  }

  if (!eventos.length) {
    app.innerHTML = tituloLinha(ehAdmin() ? 'Todos os eventos' : 'Seus eventos', '00') + (ehAdmin()
      ? `<div class="vazio"><h3>Nenhum evento ainda</h3>
           <p>Assim que os leads das palestras entrarem no funil, os eventos aparecem aqui.</p></div>`
      : `<div class="vazio"><h3>Nenhuma palestra com lead seu ainda</h3>
           <p>Assim que os contatos da sua próxima palestra entrarem no sistema, o evento aparece
              aqui. Se você palestrou nos últimos dias e nada apareceu, fale com o time de BI.</p></div>`);
    return;
  }

  app.innerHTML = tituloLinha(ehAdmin() ? 'Todos os eventos' : 'Seus eventos', dd(eventos.length)) + `
    <div class="grade">
      ${eventos.map((e) => `
        <a class="card-evento" href="#/evento/${encodeURIComponent(e.slug)}">
          ${tituloEvento(e.evento)}
          ${elenco(e.instrutores)}
          <div class="metricas">
            ${metrica(e.total, 'leads')}
            <span class="fio"></span>
            ${metrica(e.vendas, 'vendas')}
            <span class="fio"></span>
            ${metrica(pct(e.taxaConversao), 'conversão')}
          </div>
          <div class="barra-conv"><i style="width:${pct(e.taxaConversao)}"></i></div>
        </a>`).join('')}
    </div>`;

  tratarFotosQuebradas(app);
}

/* ---------------- Evento ---------------- */

function cardLead(l) {
  const detalhe = [l.curso, l.dataVenda, l.vendedor].filter(Boolean).join(' · ');
  const venda = l.vendeu
    ? `<div class="venda" title="${esc(detalhe)}">
         <span class="ponto" aria-hidden="true"></span>
         <span class="curso">${esc(l.curso ?? 'Venda registrada')}</span>
       </div>`
    : '';
  return `<div class="card-lead">
    <div class="ln">${esc(l.nome)}</div>
    <div class="contato">
      <span>${l.telefone ? esc(mascararTelefone(l.telefone)) : 'sem telefone'}</span>
      ${l.email ? `<span class="email">${esc(mascararEmail(l.email))}</span>` : ''}
    </div>
    ${venda}
  </div>`;
}

function renderKanban() {
  const { detalhe: d, filtroInstrutor: filtro } = estado;
  document.getElementById('kanban').innerHTML = d.colunas.map((c, i) => {
    const leads = filtro ? c.leads.filter((l) => l.instrutorSlug === filtro) : c.leads;
    return `<div class="coluna">
      <h4>
        <span class="ordem">${dd(i + 1)}</span>
        <span class="etapa" title="${esc(c.etapaName)}">${esc(c.etapaName)}</span>
        <span class="espaco"></span>
        <span class="conta">${leads.length}</span>
      </h4>
      <div class="coluna-fio"></div>
      <div class="coluna-leads">
        ${leads.map(cardLead).join('')
          || '<p class="coluna-vazia"><span>Nenhum lead nesta etapa</span></p>'}
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('.instrutor').forEach((el) => {
    el.classList.toggle('ativo', el.dataset.slug === filtro);
  });
}

async function telaDetalhe(slug) {
  app.innerHTML = esqueleto();
  let d;
  try { d = await pedir(`/api/eventos/${encodeURIComponent(slug)}`); }
  catch {
    app.innerHTML = `<div class="vazio"><h3>Evento não encontrado</h3>
      <p>Ele pode ter saído do funil, ou não há lead seu nele. <a href="#/">Voltar aos eventos</a></p></div>`;
    return;
  }
  estado = { detalhe: d, filtroInstrutor: null };

  const admin = ehAdmin();
  const podeFiltrar = admin && d.instrutores.length > 1;
  const meu = d.instrutores[0];

  const legenda = `<div class="legenda"><span class="ponto"></span><span>Vendeu</span></div>`;

  app.innerHTML = `
    <a class="voltar" href="#/">← ${admin ? 'Eventos' : 'Seus eventos'}</a>
    <div class="cabecalho-evento">
      ${tituloEvento(d.evento)}
      <div class="metricas">
        ${metrica(d.resumo.total, 'leads')}
        <span class="fio"></span>
        ${metrica(d.resumo.vendas, 'vendas')}
        <span class="fio"></span>
        ${metrica(pct(d.resumo.taxaConversao), 'conversão')}
      </div>
    </div>

    ${admin ? `
      ${tituloLinha('Instrutores no palco', `${dd(d.instrutores.length)}${podeFiltrar ? ' · clique para filtrar o quadro' : ''}`)}
      <div class="grade-instrutores">
        ${d.instrutores.map((ins) => `
          <div class="instrutor" data-slug="${esc(ins.slug)}">
            ${foto('foto', ins.slug, ins.instrutor)}
            <div class="nome">${esc(ins.instrutor)}</div>
            <div class="nums">
              <span class="n">${ins.total}</span><span class="l">leads</span>
              <span class="fio"></span>
              <span class="n">${ins.vendas}</span><span class="l">vendas</span>
            </div>
          </div>`).join('')}
      </div>
      ${tituloLinha('Quadro · todos os instrutores', undefined, legenda)}
    ` : `
      <div class="faixa-eu">
        ${foto('retrato', meu?.slug ?? eu.fotoSlug, meu?.instrutor ?? eu.nome)}
        <div class="quem">
          <span class="nome">${esc(meu?.instrutor ?? eu.nome)}</span>
          <span class="rotulo">Seu recorte deste evento</span>
        </div>
        <span class="espaco"></span>
        <div class="nums">
          <div><div class="n">${d.resumo.total}</div><div class="l">leads</div></div>
          <div><div class="n">${d.resumo.vendas}</div><div class="l">vendas</div></div>
        </div>
      </div>
      ${tituloLinha('Quadro', undefined, legenda)}
    `}

    <div id="kanban" class="kanban"></div>`;

  tratarFotosQuebradas(app);

  if (podeFiltrar) {
    document.querySelectorAll('.instrutor').forEach((el) => {
      el.addEventListener('click', () => {
        estado.filtroInstrutor = estado.filtroInstrutor === el.dataset.slug ? null : el.dataset.slug;
        renderKanban();
      });
    });
  }
  renderKanban();
}

/* ---------------- Admin: instrutores ---------------- */

let editando = null;

function chipsDeNomes(nomes, marcados, idAtual) {
  const disponiveis = nomes.filter((n) => !n.dono || n.dono.id === idAtual);
  if (!disponiveis.length) return '';
  return `<div class="nomes">
    ${disponiveis.map((n) => `
      <label>
        <input type="checkbox" name="vinculo" value="${esc(n.nome)}"
               ${marcados.includes(n.nome) ? 'checked' : ''}>
        <span>${esc(n.nome)}</span>
      </label>`).join('')}
  </div>`;
}

function lerVinculos(escopo) {
  const marcados = [...escopo.querySelectorAll('input[name="vinculo"]:checked')].map((i) => i.value);
  const digitados = String(escopo.querySelector('[name="outros"]')?.value ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...marcados, ...digitados])];
}

async function telaInstrutores() {
  if (!ehAdmin()) { location.hash = '#/'; return; }
  app.innerHTML = esqueleto();

  let usuarios, nomes;
  try { [usuarios, nomes] = await Promise.all([pedir('/api/admin/usuarios'), pedir('/api/admin/nomes')]); }
  catch (e) { app.innerHTML = `<div class="vazio"><h3>Não foi possível carregar</h3><p>${esc(e.message)}</p></div>`; return; }

  const orfaos = nomes.filter((n) => !n.dono);

  app.innerHTML = `
    <a class="voltar" href="#/">← Eventos</a>
    ${tituloLinha('Instrutores', dd(usuarios.length))}

    ${orfaos.length ? `
      <div class="aviso">
        ${orfaos.length === 1 ? 'Um nome aparece' : `${orfaos.length} nomes aparecem`} nos dados sem
        dono: ${orfaos.map((o) => `<strong>${esc(o.nome)}</strong>`).join(', ')}.
        Enquanto não forem vinculados, esses leads não aparecem para ninguém além da gestão.
      </div>` : ''}

    ${nomes.length ? '' : `
      <div class="aviso">
        Nenhum nome de instrutor apareceu nos dados ainda — a tabela de leads está vazia.
        Cadastre digitando o nome exatamente como ele virá no campo Conexão.
      </div>`}

    <div class="painel">
      <h3>Novo instrutor</h3>
      <p class="explica">O email precisa ser @tradestars.com.br. A senha é provisória: ele troca no primeiro acesso.</p>
      <form id="novo">
        <div class="linha-form">
          <label class="campo"><span>Email</span><input type="email" name="email" required></label>
          <label class="campo"><span>Nome</span><input type="text" name="nome" required></label>
          <label class="campo"><span>Senha provisória</span><input type="text" name="senha" required minlength="8"></label>
          <label class="campo" style="flex:0 0 150px"><span>Perfil</span>
            <select name="papel">
              <option value="instrutor">Instrutor</option>
              <option value="admin">Gestão</option>
            </select>
          </label>
        </div>
        <div style="margin-top:20px">
          <span class="campo"><span>Nome nos dados</span></span>
          ${chipsDeNomes(nomes, [], null)}
          <label class="campo" style="margin-top:12px">
            <span>Outro nome (separe por vírgula)</span>
            <input type="text" name="outros" placeholder="como aparece no campo Conexão">
          </label>
        </div>
        <p class="erro" id="erro-novo" role="alert"></p>
        <button class="botao" type="submit">Cadastrar</button>
      </form>
    </div>

    <div class="painel">
      <h3>Cadastrados</h3>
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Nome nos dados</th><th></th></tr></thead>
        <tbody>${usuarios.map((u) => linhaUsuario(u, nomes)).join('')}</tbody>
      </table>
    </div>`;

  ligarAdmin();
}

function linhaUsuario(u, nomes) {
  if (editando === u.id) {
    return `<tr data-id="${u.id}"><td colspan="5">
      <form class="edicao" data-id="${u.id}">
        <p class="explica">Vínculos de <strong>${esc(u.nome)}</strong></p>
        ${chipsDeNomes(nomes, u.vinculos, u.id)}
        <label class="campo" style="margin-top:12px">
          <span>Outro nome (separe por vírgula)</span>
          <input type="text" name="outros" value="">
        </label>
        <p class="erro" role="alert"></p>
        <div class="acoes" style="justify-content:flex-start">
          <button class="botao discreto" type="submit">Salvar vínculos</button>
          <button class="botao discreto" type="button" data-acao="cancelar">Cancelar</button>
        </div>
      </form>
    </td></tr>`;
  }
  return `<tr data-id="${u.id}" ${u.ativo ? '' : 'class="inativo"'}>
    <td>${esc(u.nome)}${u.ativo ? '' : ' <span class="etiqueta">inativo</span>'}</td>
    <td class="mono">${esc(u.email)}</td>
    <td><span class="etiqueta ${u.papel === 'admin' ? 'admin' : ''}">${u.papel === 'admin' ? 'Gestão' : 'Instrutor'}</span></td>
    <td>${u.vinculos.length
      ? u.vinculos.map((v) => esc(v)).join(', ')
      : '<span class="etiqueta orfao">sem vínculo</span>'}</td>
    <td><div class="acoes">
      <button class="botao discreto" data-acao="editar">Vínculos</button>
      <button class="botao discreto" data-acao="senha">Resetar senha</button>
      <button class="botao discreto" data-acao="ativo">${u.ativo ? 'Desativar' : 'Reativar'}</button>
    </div></td>
  </tr>`;
}

function ligarAdmin() {
  const novo = document.getElementById('novo');
  novo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = document.getElementById('erro-novo');
    erro.textContent = '';
    const d = new FormData(novo);
    try {
      await pedir('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          email: d.get('email'), nome: d.get('nome'), senha: d.get('senha'),
          papel: d.get('papel'), vinculos: lerVinculos(novo),
        }),
      });
      telaInstrutores();
    } catch (e) { erro.textContent = e.message; }
  });

  app.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelectorAll('[data-acao]').forEach((botao) => {
      botao.addEventListener('click', async (ev) => {
        const acao = botao.dataset.acao;
        if (acao === 'editar') { editando = id; telaInstrutores(); return; }
        if (acao === 'cancelar') { ev.preventDefault(); editando = null; telaInstrutores(); return; }
        if (acao === 'senha') {
          const senha = prompt('Nova senha provisória (mínimo 8 caracteres):');
          if (!senha) return;
          try {
            await pedir(`/api/admin/usuarios/${id}/senha`, { method: 'POST', body: JSON.stringify({ senha }) });
            alert('Senha redefinida. Ele troca no próximo acesso.');
          } catch (e) { alert(e.message); }
          return;
        }
        if (acao === 'ativo') {
          const desativando = botao.textContent.trim() === 'Desativar';
          try {
            await pedir(`/api/admin/usuarios/${id}`, { method: 'PUT', body: JSON.stringify({ ativo: !desativando }) });
            telaInstrutores();
          } catch (e) { alert(e.message); }
        }
      });
    });

    const form = tr.querySelector('form.edicao');
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const erro = form.querySelector('.erro');
        erro.textContent = '';
        try {
          await pedir(`/api/admin/usuarios/${id}`, {
            method: 'PUT', body: JSON.stringify({ vinculos: lerVinculos(form) }),
          });
          editando = null;
          telaInstrutores();
        } catch (e) { erro.textContent = e.message; }
      });
    }
  });
}

/* ---------------- Troca de senha obrigatória ---------------- */

function telaTrocaSenha() {
  app.innerHTML = `
    <div class="painel" style="max-width:430px;margin:6vh auto 0">
      <h3>Defina sua senha</h3>
      <p class="explica">Você entrou com uma senha provisória. Escolha uma nova para continuar.</p>
      <form id="troca">
        <label class="campo"><span>Senha provisória</span>
          <input type="password" name="senhaAtual" autocomplete="current-password" required></label>
        <label class="campo"><span>Nova senha</span>
          <input type="password" name="novaSenha" autocomplete="new-password" required minlength="8"></label>
        <p class="erro" id="erro-troca" role="alert"></p>
        <button class="botao" type="submit" style="width:100%">Salvar senha</button>
      </form>
    </div>`;

  document.getElementById('troca').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = document.getElementById('erro-troca');
    erro.textContent = '';
    const d = new FormData(ev.target);
    try {
      await pedir('/api/trocar-senha', {
        method: 'POST',
        body: JSON.stringify({ senhaAtual: d.get('senhaAtual'), novaSenha: d.get('novaSenha') }),
      });
      eu.precisaTrocarSenha = false;
      rotear();
    } catch (e) { erro.textContent = e.message; }
  });
}

/* ---------------- Rotas ---------------- */

function rotear() {
  if (eu.precisaTrocarSenha) return telaTrocaSenha();
  const hash = location.hash || '#/';
  const evento = hash.match(/^#\/evento\/(.+)$/);
  if (evento) return telaDetalhe(decodeURIComponent(evento[1]));
  if (hash === '#/instrutores') return telaInstrutores();
  return telaHome();
}

window.addEventListener('hashchange', rotear);

try {
  eu = (await pedir('/api/eu')).usuario;
  renderMenu();
  rotear();
} catch {
  // pedir() já redirecionou para /login quando a sessão não vale.
}
