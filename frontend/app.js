const app = document.getElementById('app');
const menu = document.getElementById('menu');

let eu = null;
let estado = { detalhe: null, filtroInstrutor: null, etapaAberta: 0 };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Os valores em R$ saíram da interface por decisão do produto. O backend ainda
// calcula valorTotal, então dá para trazer de volta mexendo só aqui.
// Abaixo de 10% o arredondamento para inteiro distorce demais: presença de 7,6%
// virava 8%, e a taxa dessas palestras vive nessa faixa.
function pct(v) {
  const n = (v || 0) * 100;
  return n > 0 && n < 10
    ? `${n.toFixed(1).replace('.', ',')}%`
    : `${Math.round(n)}%`;
}
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

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

/* ---------------- Peças de texto ---------------- */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-08-10" → "10 ago". Montado na mão porque `new Date` interpretaria a
// data como UTC e mostraria o dia anterior no fuso do Brasil.
function dataCurta(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : '';
}

// A palestra é identificada pela cidade; a data é o que separa duas visitas à
// mesma cidade. Os dois pesos do desenho caem certinho nisso.
//
// O desenho foi feito com "CXJ" e "SP" em mente. Cidade de verdade é longa
// ("Balneário Camboriú", "São José dos Campos") e a 46px atropela a foto, então
// o corpo cede conforme o nome cresce.
function tituloEvento(ev) {
  const n = String(ev.cidade ?? '').length;
  const porte = n <= 9 ? '' : n <= 15 ? ' medio' : ' longo';
  return `<div class="ev-nome${porte}">
    <span class="sigla">${esc(ev.cidade)}</span>
    <span class="num">${esc(dataCurta(ev.data))}</span>
  </div>`;
}

// "Elidiano e Marina no palco". Acima de três vira "e mais N" — a linha é uma
// frase, não uma lista, e precisa continuar cabendo numa linha.
function quemNoPalco(instrutores) {
  const nomes = (instrutores ?? []).map((i) => i.instrutor);
  if (!nomes.length) return '';
  if (!ehAdmin() && nomes.length === 1) return 'Você no palco';
  let frase;
  if (nomes.length === 1) frase = nomes[0];
  else if (nomes.length <= 3) frase = `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  else frase = `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
  return `${frase} no palco`;
}

// Da palestra: quem apareceu na sala e quanto disso virou venda. O número de
// leads fica junto porque é o trabalho que sobra para o instrutor.
function metricasPalestra(p) {
  return `<div class="metricas">
    <span class="metrica"><b>${p.presentes}</b> presentes</span>
    <span class="metrica"><b>${p.vendas}</b> ${p.vendas === 1 ? 'venda' : 'vendas'}</span>
    <span class="metrica conv"><b>${pct(p.conversao)}</b> conversão</span>
    <span class="metrica"><b>${p.leads}</b> ${p.leads === 1 ? 'lead' : 'leads'}</span>
  </div>`;
}

// Do recorte de um instrutor: só o que ele tem para trabalhar.
function metricasLeads(r, { conversao = true } = {}) {
  return `<div class="metricas">
    <span class="metrica"><b>${r.total}</b> ${r.total === 1 ? 'lead' : 'leads'}</span>
    <span class="metrica"><b>${r.vendas}</b> ${r.vendas === 1 ? 'venda' : 'vendas'}</span>
    ${conversao ? `<span class="metrica conv"><b>${pct(r.taxaConversao)}</b> conversão</span>` : ''}
  </div>`;
}

function tituloLinha(texto, nota, extra = '') {
  return `<div class="titulo-linha">
    <h2 class="titulo-secao">${esc(texto)}</h2>
    ${nota ? `<span class="titulo-nota">${esc(nota)}</span>` : ''}
    ${extra ? `<span class="espaco"></span>${extra}` : ''}
  </div>`;
}

const legendaVenda = '<span class="legenda"><span class="ponto"></span><span>comprou</span></span>';

function iniciais(nome) {
  return String(nome ?? '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

// As etapas chegam gritando ("EM CONTATO", "JÁ É ALDEIA"). O desenho é todo em
// caixa baixa, e caixa alta no meio dele vira ruído.
function frase(s) {
  const t = String(s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;
}

/* ---------------- Fotos cortadas na diagonal ---------------- */

// Quanto a aresta anda da direita para a esquerda, em % da área de foto.
const CORTE = 30;
// Altura em que o rosto costuma cair na foto, contada do topo.
const ROSTO = 0.28;

// Uma faixa por instrutor. O âmbar é a forma de trás; a foto vem por cima
// deslocada 2px, e a fresta que sobra vira o fio do corte.
function elenco(instrutores, limite) {
  const mostra = (instrutores ?? []).slice(0, limite);
  const n = mostra.length;
  if (!n) return '';

  return `<div class="elenco">
    ${mostra.map((ins, k) => {
      const b0 = CORTE + (k * (100 - CORTE)) / n;
      const b1 = CORTE + ((k + 1) * (100 - CORTE)) / n;
      const ultima = k === n - 1;
      const dirAlto = ultima ? 100 : b1;
      const dirBaixo = ultima ? 100 : b1 - CORTE;

      const fora = `polygon(${b0}% 0, ${dirAlto}% 0, ${dirBaixo}% 100%, ${b0 - CORTE}% 100%)`;
      const dentro = `polygon(calc(${b0}% + 2px) 0, ${ultima ? '100%' : `calc(${b1}% + 2px)`} 0, `
        + `${ultima ? '100%' : `calc(${dirBaixo}% + 2px)`} 100%, calc(${b0 - CORTE}% + 2px) 100%)`;

      // Onde o rosto precisa cair: o meio da faixa na altura dele. A última tem
      // a borda direita reta, e por isso seu meio fica mais à direita.
      const alvo = ultima
        ? (b0 - CORTE * ROSTO + 100) / 2
        : (b0 + b1) / 2 - CORTE * ROSTO;
      const limEsq = b0 - CORTE;
      const limDir = ultima ? 100 : b1;
      const esquerda = Math.min(limEsq, 2 * alvo - limDir);
      const largura = 2 * (alvo - esquerda);
      // Centro geométrico da faixa, para as iniciais de quem não tem foto.
      const centro = ((b0 + dirAlto) / 2 + ((b0 - CORTE) + dirBaixo) / 2) / 2;

      return `<span class="faixa" style="clip-path:${fora}" data-centro="${centro}">
        <span class="dentro" style="clip-path:${dentro}">
          <img class="rosto" src="/public/instrutores/${esc(ins.slug)}.jpg" alt="${esc(ins.instrutor)}"
               data-iniciais="${esc(iniciais(ins.instrutor))}" style="left:${esquerda}%;width:${largura}%">
        </span>
      </span>`;
    }).join('')}
    <span class="veu"></span>
  </div>`;
}

// Sem arquivo de foto, a faixa mostra as iniciais no centro dela.
function tratarFotosQuebradas(raiz = document) {
  raiz.querySelectorAll('img[data-iniciais]').forEach((img) => {
    img.addEventListener('error', () => {
      const faixa = img.closest('.faixa');
      if (!faixa) { // avatar do topo
        const span = document.createElement('span');
        span.className = img.className;
        span.textContent = img.dataset.iniciais;
        img.replaceWith(span);
        return;
      }
      const ini = document.createElement('span');
      ini.className = 'ini';
      ini.style.left = `${faixa.dataset.centro}%`;
      ini.textContent = img.dataset.iniciais;
      img.remove();
      faixa.appendChild(ini);
    }, { once: true });
  });
}

/* ---------------- Topo ---------------- */

const rotuloTema = () => (document.documentElement.dataset.tema === 'claro' ? 'Tema escuro' : 'Tema claro');

function alternarTema() {
  const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
  document.documentElement.dataset.tema = novo;
  localStorage.setItem('hub-tema', novo);
  const botao = document.getElementById('tema');
  if (botao) botao.textContent = rotuloTema();
}

function renderMenu() {
  const admin = ehAdmin();
  menu.innerHTML = `
    <div class="eu-quem">
      ${admin
        ? `<span class="eu-selo">${esc(iniciais(eu.nome))}</span>`
        : `<img class="eu-selo" src="/public/instrutores/${esc(eu.fotoSlug)}.jpg"
             alt="" data-iniciais="${esc(iniciais(eu.nome))}">`}
      <span class="eu-nome">${esc(eu.nome)}</span>
      <span class="eu-papel">${admin ? 'gestão' : 'instrutor'}</span>
    </div>
    <span class="fio-vertical"></span>
    ${admin ? '<a class="link-topo" href="#/instrutores">Instrutores</a>' : ''}
    <button class="link-topo" type="button" id="tema">${rotuloTema()}</button>
    <button class="link-topo" type="button" id="sair">Sair</button>`;
  tratarFotosQuebradas(menu);
  document.getElementById('tema').addEventListener('click', alternarTema);
  document.getElementById('sair').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
}

/* ---------------- Home ---------------- */

const esqueleto = () => '<div class="esqueleto"><div></div><div></div></div>';

async function telaHome() {
  const titulo = ehAdmin() ? 'Todos os eventos' : 'Seus eventos';
  app.innerHTML = tituloLinha(titulo) + esqueleto();

  let eventos;
  try { eventos = await pedir('/api/eventos'); }
  catch {
    app.innerHTML = tituloLinha(titulo) + `<div class="vazio">
      <h3>Não foi possível carregar os eventos</h3>
      <p>A consulta aos dados falhou. Recarregue a página; se continuar, fale com o time de BI.</p></div>`;
    return;
  }

  if (!eventos.length) {
    app.innerHTML = tituloLinha(titulo, 'nenhum ainda') + (ehAdmin()
      ? `<div class="vazio"><h3>Nenhuma palestra com lead registrado</h3>
           <p>Os contatos entram no sistema depois do evento. Assim que os primeiros chegarem,
              as palestras aparecem aqui.</p></div>`
      : `<div class="vazio"><h3>Nenhuma palestra com lead seu chegou até aqui</h3>
           <p>Os contatos entram no sistema depois do evento. Se você palestrou nos últimos dias
              e nada apareceu, fale com o time de BI.</p></div>`);
    return;
  }

  const nota = ehAdmin()
    ? `${plural(eventos.length, 'palestra', 'palestras')} registradas`
    : `${plural(eventos.length, 'palestra', 'palestras')} suas`;

  app.innerHTML = (ehAdmin() ? await avisoDeSaude() : '') + tituloLinha(titulo, nota) + `
    <div class="grade">
      ${eventos.map((e) => `
        <a class="card-evento" href="#/evento/${encodeURIComponent(e.slug)}">
          ${elenco(e.instrutores, 3)}
          <div class="miolo">
            <div>
              ${tituloEvento(e)}
              <div class="ev-quem">${esc(quemNoPalco(e.instrutores))}</div>
            </div>
            ${metricasPalestra(e)}
          </div>
          <div class="barra-conv"><i style="width:${pct(e.conversao)}"></i></div>
        </a>`).join('')}
    </div>`;

  tratarFotosQuebradas(app);
}

// A origem grava ausência como a palavra "null": esses leads são descartados na
// consulta. Mostrar o número é o que impede o problema de passar despercebido.
async function avisoDeSaude() {
  let s;
  try { s = await pedir('/api/admin/saude'); } catch { return ''; }
  const partes = [];
  if (s.descartados) {
    partes.push(`<strong>${s.descartados}</strong> ${s.descartados === 1 ? 'lead veio' : 'leads vieram'}
      sem evento ou etapa identificada e ${s.descartados === 1 ? 'ficou' : 'ficaram'} de fora`);
  }
  if (s.semPalestra) {
    partes.push(`<strong>${s.semPalestra}</strong> ${s.semPalestra === 1 ? 'lead aponta' : 'leads apontam'}
      para uma cidade sem palestra cadastrada`);
  }
  if (!partes.length) return '';
  return `<div class="aviso">${partes.join('. ')}. Vale cobrar a origem dos dados.</div>`;
}

/* ---------------- Evento ---------------- */

function cardLead(l) {
  const detalhe = [l.curso, l.dataVenda, l.vendedor].filter(Boolean).join(' · ');
  return `<div class="card-lead">
    <div class="topo-lead">
      <span class="ln">${esc(l.nome)}</span>
      ${ehAdmin() ? `<span class="de">${esc(l.instrutor)}</span>` : ''}
    </div>
    <div class="tel">${l.telefone ? esc(mascararTelefone(l.telefone)) : 'sem telefone'}</div>
    ${l.email ? `<div class="email">${esc(mascararEmail(l.email))}</div>` : ''}
    ${l.vendeu ? `<div class="venda" title="${esc(detalhe)}">
      <span class="ponto"></span>
      <span class="curso">${esc(l.curso ?? 'Venda registrada')}</span>
    </div>` : ''}
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

function renderKanban() {
  const { detalhe: d, filtroInstrutor: filtro, etapaAberta } = estado;
  const porColuna = d.colunas.map((c) => (filtro ? c.leads.filter((l) => l.instrutorSlug === filtro) : c.leads));

  document.getElementById('chips').innerHTML = d.colunas.map((c, i) =>
    `<button type="button" class="${i === etapaAberta ? 'on' : ''}" data-etapa="${i}">
      ${esc(frase(c.etapaName))} ${porColuna[i].length}</button>`).join('');

  document.getElementById('kanban').innerHTML = d.colunas.map((c, i) => `
    <div class="coluna${i === etapaAberta ? ' aberta' : ''}">
      <h4>
        <span>${esc(frase(c.etapaName))}</span>
        <span class="espaco"></span>
        <span class="conta">${porColuna[i].length}</span>
      </h4>
      <div class="coluna-leads">
        ${porColuna[i].map(cardLead).join('')
          || '<p class="coluna-vazia">Nenhum lead nesta etapa</p>'}
      </div>
    </div>`).join('');

  document.querySelectorAll('#chips button').forEach((b) => {
    b.addEventListener('click', () => { estado.etapaAberta = Number(b.dataset.etapa); renderKanban(); });
  });
  document.querySelectorAll('.instrutor').forEach((el) => {
    el.classList.toggle('ativo', el.dataset.slug === filtro);
  });
}

async function telaDetalhe(slug) {
  app.innerHTML = esqueleto();
  let d;
  try { d = await pedir(`/api/eventos/${encodeURIComponent(slug)}`); }
  catch {
    app.innerHTML = `<div class="vazio"><h3>Palestra não encontrada</h3>
      <p>Ela pode ter saído da base, ou você não subiu naquele palco.
         <a href="#/">Voltar às palestras</a></p></div>`;
    return;
  }
  estado = { detalhe: d, filtroInstrutor: null, etapaAberta: 0 };

  const admin = ehAdmin();
  const podeFiltrar = admin && d.instrutores.length > 1;

  app.innerHTML = `
    <a class="voltar" href="#/">← Palestras</a>
    <div class="faixa-evento">
      ${elenco(d.instrutores, 1)}
      <div class="miolo">
        <div>
          ${tituloEvento(d)}
          <div class="ev-quem">${esc(quemNoPalco(d.instrutores))}</div>
        </div>
        ${metricasPalestra(d)}
      </div>
    </div>

    <div class="painel numeros">
      <div class="bloco">
        <span class="rotulo">Presença</span>
        <div class="metricas">
          <span class="metrica"><b>${d.cadastrados}</b> cadastrados</span>
          <span class="metrica"><b>${d.presentes}</b> check-in geral</span>
          <span class="metrica conv"><b>${pct(d.pctPresenca)}</b> presentes</span>
        </div>
        <div class="metricas menor">
          <span class="metrica"><b>${d.presentesLead}</b> lead</span>
          <span class="metrica"><b>${d.presentesTribo}</b> tribo</span>
          <span class="metrica"><b>${d.presentesAldeia}</b> aldeia</span>
        </div>
      </div>
      <div class="bloco">
        <span class="rotulo">Vendas</span>
        <div class="metricas">
          <span class="metrica"><b>${d.vendasTotais}</b> ${d.vendasTotais === 1 ? 'total' : 'totais'}</span>
          <span class="metrica"><b>${d.vendasAPagar}</b> a pagar</span>
          <span class="metrica"><b>${d.canceladas}</b> ${d.canceladas === 1 ? 'cancelada' : 'canceladas'}</span>
          <span class="metrica conv"><b>${d.vendas}</b> ${d.vendas === 1 ? 'efetiva' : 'efetivas'}</span>
        </div>
      </div>
    </div>

    ${admin ? `
      <div style="margin-top:30px">
        ${tituloLinha('Instrutores no palco', podeFiltrar ? 'clique para filtrar o quadro' : '')}
        <div class="grade-instrutores">
          ${d.instrutores.map((ins) => `
            <div class="instrutor" data-slug="${esc(ins.slug)}">
              <div class="miolo">
                <span class="nome">${esc(ins.instrutor)}</span>
                ${metricasLeads(ins, { conversao: false })}
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-top:32px">
        ${tituloLinha('Quadro', 'todos os instrutores', legendaVenda)}
      </div>
    ` : `<div style="margin-top:30px">${tituloLinha('Seus leads', '', legendaVenda)}</div>`}

    <div id="chips" class="chips"></div>
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
  catch (e) {
    app.innerHTML = `<div class="vazio"><h3>Não foi possível carregar</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  const orfaos = nomes.filter((n) => !n.dono);

  app.innerHTML = `
    <a class="voltar" href="#/">← Eventos</a>
    <div style="margin-top:22px">
      ${tituloLinha('Instrutores', `${plural(usuarios.length, 'cadastrado', 'cadastrados')}`)}
    </div>

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
    <div class="painel" style="max-width:420px;margin:5vh auto 0">
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
