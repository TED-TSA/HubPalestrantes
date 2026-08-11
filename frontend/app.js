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
    <div class="lt">${l.telefone ? mascararTelefone(l.telefone) : 'sem telefone'}</div>
    ${l.email ? `<div class="lt">${mascararEmail(l.email)}</div>` : ''}
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

function rotear() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/evento\/(.+)$/);
  if (m) telaDetalhe(decodeURIComponent(m[1]));
  else telaHome();
}

window.addEventListener('hashchange', rotear);
rotear();
