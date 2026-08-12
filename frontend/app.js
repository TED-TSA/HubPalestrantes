const app = document.getElementById('app');
const menu = document.getElementById('menu');

let eu = null;
let estado = { detalhe: null, filtroInstrutor: null };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const moeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

function metrica(n, l) {
  return `<div class="metrica"><div class="n">${n}</div><div class="l">${l}</div></div>`;
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
  return String(nome).split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

// Troca a <img> por um avatar de iniciais quando o arquivo não existe. Feito com
// listener em vez de onerror inline para não injetar nome de gente em atributo.
function tratarFotosQuebradas(raiz = document) {
  raiz.querySelectorAll('img[data-iniciais]').forEach((img) => {
    img.addEventListener('error', () => {
      if (img.classList.contains('retrato')) { img.remove(); return; }
      const div = document.createElement('div');
      div.className = 'avatar-iniciais';
      div.textContent = img.dataset.iniciais;
      img.replaceWith(div);
    }, { once: true });
  });
}

/* ---------------- Topo ---------------- */

function renderMenu() {
  const admin = ehAdmin();
  menu.innerHTML = `
    <div class="eu">
      ${admin ? '' : `<img class="retrato" src="/public/instrutores/${esc(eu.fotoSlug)}.jpg"
          alt="" data-iniciais="${esc(iniciais(eu.nome))}">`}
      <div>
        <div class="quem">${esc(eu.nome)}</div>
        <div class="papel">${admin ? 'Gestão' : 'Instrutor'}</div>
      </div>
      ${admin ? '<a class="link-topo" href="#/instrutores">Instrutores</a>' : ''}
      <button class="link-topo" type="button" id="sair">Sair</button>
    </div>`;
  tratarFotosQuebradas(menu);
  document.getElementById('sair').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
}

/* ---------------- Home ---------------- */

async function telaHome() {
  app.innerHTML = '<p class="carregando">Carregando eventos…</p>';
  let eventos;
  try { eventos = await pedir('/api/eventos'); }
  catch { app.innerHTML = '<p class="vazio">Não foi possível carregar os eventos.</p>'; return; }

  if (!eventos.length) {
    app.innerHTML = ehAdmin()
      ? '<p class="vazio">Nenhum evento ainda. Assim que os leads caírem, eles aparecem aqui.</p>'
      : `<p class="vazio">Nenhum lead vinculado a você ainda.<br>
           Assim que os contatos da sua palestra entrarem no funil, os eventos aparecem aqui.</p>`;
    return;
  }

  app.innerHTML = `
    <h2 class="titulo-secao">${ehAdmin() ? 'Todos os eventos' : 'Seus eventos'}</h2>
    <div class="grade">
      ${eventos.map((e) => `
        <a class="card-evento" href="#/evento/${encodeURIComponent(e.slug)}">
          <h3>${esc(e.evento)}</h3>
          <div class="metricas">
            ${metrica(e.total, 'leads')}
            ${metrica(e.vendas, 'vendas')}
            ${metrica(`<span class="pill-venda">${moeda(e.valorTotal)}</span>`, 'gerado')}
          </div>
        </a>`).join('')}
    </div>`;
}

/* ---------------- Evento ---------------- */

function cardLead(l) {
  // Curso e valor em uma linha só. O verde já comunica a venda, então o selo
  // "VENDEU" saiu: ele quebrava linha e dobrava a altura do card.
  const detalhe = [l.curso, l.dataVenda, l.vendedor].filter(Boolean).join(' · ');
  const venda = l.vendeu
    ? `<div class="venda" title="${esc(detalhe)}">
         <span class="ponto" aria-hidden="true"></span>
         <span class="curso">${esc(l.curso ?? 'Venda registrada')}</span>
         ${l.valorPago ? `<span class="valor">${moeda(l.valorPago)}</span>` : ''}
       </div>`
    : '';
  return `<div class="card-lead${l.vendeu ? ' vendeu' : ''}">
    <div class="ln">${esc(l.nome)}</div>
    <div class="lt">${l.telefone ? esc(mascararTelefone(l.telefone)) : 'sem telefone'}</div>
    ${l.email ? `<div class="lt">${esc(mascararEmail(l.email))}</div>` : ''}
    ${venda}
  </div>`;
}

function renderKanban() {
  const { detalhe: d, filtroInstrutor: filtro } = estado;
  document.getElementById('kanban').innerHTML = d.colunas.map((c, i) => {
    const leads = filtro ? c.leads.filter((l) => l.instrutorSlug === filtro) : c.leads;
    return `<div class="coluna">
      <h4>
        <span class="ordem">${String(i + 1).padStart(2, '0')}</span>
        <span class="etapa" title="${esc(c.etapaName)}">${esc(c.etapaName)}</span>
        <span class="conta">${leads.length}</span>
      </h4>
      <div class="coluna-leads">
        ${leads.map(cardLead).join('') || '<p class="coluna-vazia">Nenhum lead nesta etapa</p>'}
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('.instrutor').forEach((el) => {
    el.classList.toggle('ativo', el.dataset.slug === filtro);
  });
}

async function telaDetalhe(slug) {
  app.innerHTML = '<p class="carregando">Carregando evento…</p>';
  let d;
  try { d = await pedir(`/api/eventos/${encodeURIComponent(slug)}`); }
  catch { app.innerHTML = '<p class="vazio">Evento não encontrado. <a href="#/">Voltar</a></p>'; return; }
  estado = { detalhe: d, filtroInstrutor: null };

  // O filtro só existe para quem enxerga mais de um instrutor.
  const podeFiltrar = ehAdmin() && d.instrutores.length > 1;

  app.innerHTML = `
    <a class="voltar" href="#/">← ${ehAdmin() ? 'Eventos' : 'Seus eventos'}</a>
    <div class="cabecalho-evento">
      <h2>${esc(d.evento)}</h2>
      <div class="metricas">
        ${metrica(d.resumo.total, 'leads')}
        ${metrica(d.resumo.vendas, 'vendas')}
        ${metrica(`<span class="pill-venda">${moeda(d.resumo.valorTotal)}</span>`, 'gerado')}
      </div>
    </div>
    <div class="faixa-instrutores">
      ${d.instrutores.map((ins) => `
        <div class="instrutor" data-slug="${esc(ins.slug)}">
          <img class="foto" src="/public/instrutores/${esc(ins.slug)}.jpg"
               alt="${esc(ins.instrutor)}" data-iniciais="${esc(iniciais(ins.instrutor))}">
          <div class="nome">${esc(ins.instrutor)}</div>
          <div class="mini">${ins.total} leads · ${ins.vendas} vendas</div>
        </div>`).join('')}
    </div>
    ${podeFiltrar ? `
      <div class="filtros">
        <button id="ftodos" class="on" type="button">Todos</button>
        <span class="lt">clique num instrutor para filtrar</span>
      </div>` : ''}
    <div id="kanban" class="kanban"></div>`;

  tratarFotosQuebradas(app);

  if (podeFiltrar) {
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
  app.innerHTML = '<p class="carregando">Carregando cadastro…</p>';

  let usuarios, nomes;
  try { [usuarios, nomes] = await Promise.all([pedir('/api/admin/usuarios'), pedir('/api/admin/nomes')]); }
  catch (e) { app.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }

  const orfaos = nomes.filter((n) => !n.dono);

  app.innerHTML = `
    <a class="voltar" href="#/">← Eventos</a>
    <h2 class="titulo-secao" style="margin-top:14px">Instrutores</h2>

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
          <label class="campo" style="flex:0 0 140px"><span>Perfil</span>
            <select name="papel">
              <option value="instrutor">Instrutor</option>
              <option value="admin">Gestão</option>
            </select>
          </label>
        </div>
        <div style="margin-top:16px">
          <span class="campo" style="margin-bottom:8px"><span>Nome nos dados</span></span>
          ${chipsDeNomes(nomes, [], null)}
          <label class="campo" style="margin-top:10px">
            <span>Outro nome (separe por vírgula)</span>
            <input type="text" name="outros" placeholder="como aparece no campo Conexão">
          </label>
        </div>
        <p class="erro" id="erro-novo" role="alert"></p>
        <button class="botao" type="submit" style="width:auto">Cadastrar</button>
      </form>
    </div>

    <div class="painel">
      <h3>Cadastrados</h3>
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Nome nos dados</th><th></th></tr></thead>
        <tbody>
          ${usuarios.map((u) => linhaUsuario(u, nomes)).join('')}
        </tbody>
      </table>
    </div>`;

  ligarAdmin();
}

function linhaUsuario(u, nomes) {
  if (editando === u.id) {
    return `<tr data-id="${u.id}"><td colspan="5">
      <form class="edicao" data-id="${u.id}">
        <p class="explica" style="margin-bottom:10px">Vínculos de <strong>${esc(u.nome)}</strong></p>
        ${chipsDeNomes(nomes, u.vinculos, u.id)}
        <label class="campo" style="margin-top:10px">
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
    <td class="lt">${esc(u.email)}</td>
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
    <div class="painel" style="max-width:440px;margin:8vh auto 0">
      <h3>Defina sua senha</h3>
      <p class="explica">Você entrou com uma senha provisória. Escolha uma nova para continuar.</p>
      <form id="troca">
        <label class="campo"><span>Senha provisória</span>
          <input type="password" name="senhaAtual" autocomplete="current-password" required></label>
        <label class="campo"><span>Nova senha</span>
          <input type="password" name="novaSenha" autocomplete="new-password" required minlength="8"></label>
        <p class="erro" id="erro-troca" role="alert"></p>
        <button class="botao" type="submit">Salvar senha</button>
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
  app.classList.toggle('amplo', !!evento);
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
