import { dataCurta } from './datas.js';
import { filtrarEventos, opcoesDeFiltro, SEM_FILTRO } from './filtros.js';

const app = document.getElementById('app');
const menu = document.getElementById('menu');

let eu = null;
let estado = { detalhe: null, etapaAberta: 0, buscaLead: '' };

// Fora do `estado`: a tela de detalhe reescreve aquele objeto inteiro, e a
// escolha de filtro precisa sobreviver a entrar num evento e voltar.
let eventosDaHome = [];
let filtroDaHome = { ...SEM_FILTRO };

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

// A palestra é identificada pela cidade; a data é o que separa duas visitas à
// mesma cidade. Os dois pesos do desenho caem certinho nisso.
//
// `ajustarAoNome` encolhe o corpo conforme o nome cresce — o desenho foi feito
// com "CXJ" e "SP" em mente, e "Balneário Camboriú" a 54px atropela a foto. Vale
// na faixa do evento, que tem largura inteira. No card da home não vale: com
// três cards por linha o tamanho precisa ser o mesmo em todos, senão a grade
// vira uma serra de corpos diferentes.
function tituloEvento(ev, { ajustarAoNome = true } = {}) {
  const n = String(ev.cidade ?? '').length;
  const porte = !ajustarAoNome ? '' : n <= 9 ? '' : n <= 15 ? ' medio' : ' longo';
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

// Da palestra: quem apareceu na sala e quanto disso virou venda. Na home é a
// única métrica de leads da tela, mas no detalhe do evento o total já tem um
// bloco próprio ao lado de Presença/Vendas — repetir aqui viraria a mesma
// contagem em dois lugares, então `comLeads` desliga essa métrica ali.
function metricasPalestra(p, { comLeads = true } = {}) {
  return `<div class="metricas">
    <span class="metrica"><b>${p.presentes}</b> presentes</span>
    <span class="metrica"><b>${p.vendas}</b> ${p.vendas === 1 ? 'venda' : 'vendas'}</span>
    <span class="metrica conv"><b>${pct(p.conversao)}</b> conversão</span>
    ${comLeads ? `<span class="metrica"><b>${p.leads}</b> ${p.leads === 1 ? 'lead' : 'leads'}</span>` : ''}
  </div>`;
}

function tituloLinha(texto, nota) {
  return `<div class="titulo-linha">
    <h2 class="titulo-secao">${esc(texto)}</h2>
    ${nota ? `<span class="titulo-nota">${esc(nota)}</span>` : ''}
  </div>`;
}


function iniciais(nome) {
  return String(nome ?? '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

// As etapas chegam gritando ("EM CONTATO", "JÁ É ALDEIA"). O desenho é todo em
// caixa baixa, e caixa alta no meio dele vira ruído.
function frase(s) {
  const t = String(s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;
}

// Ao lado do título do quadro. O placeholder já avisa a regra: nome pode ser
// parcial, telefone/e-mail só acham o lead quando digitados por inteiro.
function buscaLeadHtml() {
  return `<label class="busca-lead">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
    <input type="text" id="busca-lead" autocomplete="off"
      placeholder="Nome, ou telefone/e-mail completo" value="${esc(estado.buscaLead ?? '')}">
  </label>`;
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

      // Quem não tem arquivo já vem com as iniciais: pedir a imagem para tomar
      // 404 e só então trocar custava dezenas de requisições por tela.
      const dentroDaFaixa = ins.temFoto === false
        ? `<span class="ini" style="left:${centro}%">${esc(iniciais(ins.instrutor))}</span>`
        : `<span class="dentro" style="clip-path:${dentro}">
             <img class="rosto" src="/instrutores/${esc(ins.slug)}.jpg" alt="${esc(ins.instrutor)}"
                  data-iniciais="${esc(iniciais(ins.instrutor))}" style="left:${esquerda}%;width:${largura}%">
           </span>`;
      return `<span class="faixa" style="clip-path:${fora}" data-centro="${centro}">${dentroDaFaixa}</span>`;
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

// Só a lateral da gestão recolhe — a barra horizontal do instrutor não tem
// esse conceito. Lembrada entre sessões, como o tema.
const rotuloRecolher = () => (document.body.classList.contains('lateral-recolhida') ? '›' : '‹ Recolher');

function alternarLateral() {
  const recolhida = document.body.classList.toggle('lateral-recolhida');
  localStorage.setItem('hub-lateral-recolhida', recolhida ? '1' : '0');
  const botao = document.getElementById('recolher');
  if (botao) botao.textContent = rotuloRecolher();
}

function renderMenu() {
  const admin = ehAdmin();
  // Gestão trabalha em muitas telas e ganha a lateral fixa; o instrutor entra
  // para ver o próprio recorte e volta a sair — a barra horizontal de sempre
  // cabe melhor na visita curta.
  document.body.classList.toggle('layout-topo', !admin);
  document.body.classList.toggle('lateral-recolhida', admin && localStorage.getItem('hub-lateral-recolhida') === '1');
  menu.innerHTML = `
    <div class="eu-links">
      <a class="link-lateral" href="#/">Eventos</a>
      ${admin ? `<a class="link-lateral" href="#/instrutores">Instrutores</a>
        <a class="link-lateral" href="#/crm-pipelines">Pipelines CRM</a>` : ''}
    </div>
    <div class="eu-rodape">
      <div class="eu-quem">
        ${admin
          ? `<span class="eu-selo">${esc(iniciais(eu.nome))}</span>`
          : `<img class="eu-selo" src="/instrutores/${esc(eu.fotoSlug)}.jpg"
               alt="" data-iniciais="${esc(iniciais(eu.nome))}">`}
        <span class="eu-nome">${esc(eu.nome)}</span>
        <span class="eu-papel">${admin ? 'gestão' : 'instrutor'}</span>
      </div>
      <button class="link-lateral" type="button" id="tema">${rotuloTema()}</button>
      ${admin ? `<button class="link-lateral" type="button" id="recolher">${rotuloRecolher()}</button>` : ''}
      <button class="link-lateral" type="button" id="sair">Sair</button>
    </div>`;
  tratarFotosQuebradas(menu);
  document.getElementById('tema').addEventListener('click', alternarTema);
  document.getElementById('recolher')?.addEventListener('click', alternarLateral);
  document.getElementById('sair').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/login';
  });
}

/* ---------------- Home ---------------- */

const esqueleto = () => '<div class="esqueleto"><div></div><div></div><div></div></div>';

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

  eventosDaHome = eventos;

  app.innerHTML = (ehAdmin() ? await avisoDeSaude() : '')
    + '<div id="cabeca"></div>'
    + barraDeFiltros(eventos)
    + '<div id="grade"></div>';

  ligarFiltros();
  renderGrade();
}

/* ---------------- Filtros da home ---------------- */

// O popup do <select> nativo nem sempre respeita o tema — em algumas
// combinações de Chrome+Windows é o sistema operacional quem desenha aquela
// lista, não a página, e não dá pra garantir escuro só com CSS. Por isso o
// dropdown é feito na mão: um botão-gatilho e uma lista própria, sempre no
// tema certo porque é tudo <button> nosso.
const iconeSetaSeletor = `<svg class="seletor-seta" viewBox="0 0 24 24" aria-hidden="true">
  <path d="m6 9 6 6 6-6"/>
</svg>`;

// Um seletor com uma única opção não é escolha, é ruído: o de palestrante só
// aparece para quem tem mais de um, e o de cidade só quando houver duas.
function seletor(nome, rotulo, opcoes, escolhido) {
  if (opcoes.length < 2) return '';
  const todas = [{ valor: '', rotulo: 'Todos' }, ...opcoes];
  const atual = todas.find((o) => o.valor === (escolhido || '')) ?? todas[0];
  return `<label class="filtro">
    <span>${esc(rotulo)}</span>
    <div class="seletor" data-nome="${esc(nome)}">
      <button type="button" class="seletor-gatilho" aria-haspopup="listbox" aria-expanded="false">
        <span class="seletor-valor">${esc(atual.rotulo)}</span>
        ${iconeSetaSeletor}
      </button>
      <div class="seletor-lista" role="listbox" hidden>
        ${todas.map((o) => `<button type="button" role="option"
          class="seletor-opcao${o.valor === atual.valor ? ' ativa' : ''}"
          aria-selected="${o.valor === atual.valor}" data-valor="${esc(o.valor)}">${esc(o.rotulo)}</button>`).join('')}
      </div>
    </div>
  </label>`;
}

function barraDeFiltros(eventos) {
  const o = opcoesDeFiltro(eventos);
  const cidades = o.cidades.map((c) => ({ valor: c, rotulo: c }));
  const campos = seletor('periodo', 'Período', o.periodos, filtroDaHome.periodo)
    + seletor('cidade', 'Cidade', cidades, filtroDaHome.cidade)
    + seletor('palestrante', 'Palestrante', o.palestrantes, filtroDaHome.palestrante);
  if (!campos) return '';
  return `<div class="filtros" id="filtros">${campos}
    <button class="botao discreto" type="button" id="limpar">Limpar</button>
  </div>`;
}

// Só um dropdown aberto por vez — abrir um fecha os outros.
function fecharSeletores() {
  document.querySelectorAll('#filtros .seletor.aberto').forEach((el) => {
    el.classList.remove('aberto');
    el.querySelector('.seletor-gatilho').setAttribute('aria-expanded', 'false');
    el.querySelector('.seletor-lista').hidden = true;
  });
}

// Os seletores não são redesenhados a cada filtragem — só a grade é. Então
// limpar precisa devolver cada um ao "Todos" na mão.
function limparFiltros() {
  filtroDaHome = { ...SEM_FILTRO };
  document.querySelectorAll('#filtros .seletor').forEach((el) => {
    const opcoes = el.querySelectorAll('.seletor-opcao');
    const todos = opcoes[0]; // "Todos" é sempre a primeira opção
    el.querySelector('.seletor-valor').textContent = todos.textContent;
    opcoes.forEach((o, i) => {
      o.classList.toggle('ativa', i === 0);
      o.setAttribute('aria-selected', String(i === 0));
    });
  });
  fecharSeletores();
  renderGrade();
}

function ligarFiltros() {
  const barra = document.getElementById('filtros');
  if (!barra) return;

  barra.querySelectorAll('.seletor').forEach((el) => {
    const gatilho = el.querySelector('.seletor-gatilho');
    const lista = el.querySelector('.seletor-lista');

    gatilho.addEventListener('click', () => {
      const vaiAbrir = !el.classList.contains('aberto');
      fecharSeletores();
      if (vaiAbrir) {
        el.classList.add('aberto');
        gatilho.setAttribute('aria-expanded', 'true');
        lista.hidden = false;
      }
    });

    lista.querySelectorAll('.seletor-opcao').forEach((opcao) => {
      opcao.addEventListener('click', () => {
        filtroDaHome = { ...filtroDaHome, [el.dataset.nome]: opcao.dataset.valor };
        gatilho.querySelector('.seletor-valor').textContent = opcao.textContent;
        lista.querySelectorAll('.seletor-opcao').forEach((o) => {
          o.classList.toggle('ativa', o === opcao);
          o.setAttribute('aria-selected', String(o === opcao));
        });
        fecharSeletores();
        renderGrade();
      });
    });
  });

  document.getElementById('limpar').addEventListener('click', limparFiltros);
}

// Fecham o dropdown aberto ao clicar fora ou apertar Esc. Registrado uma vez
// só (não a cada render da home) — fecharSeletores() não faz nada se não
// houver barra de filtros na tela.
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('.seletor')) fecharSeletores();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') fecharSeletores();
});

const temFiltro = () => Object.values(filtroDaHome).some(Boolean);

function renderGrade() {
  const eventos = filtrarEventos(eventosDaHome, filtroDaHome);
  const total = eventosDaHome.length;
  const titulo = ehAdmin() ? 'Todos os eventos' : 'Seus eventos';

  // Com filtro ligado, o que interessa é quanto do todo sobrou — o número solto
  // faria parecer que a base encolheu.
  const nota = temFiltro()
    ? `${eventos.length} de ${plural(total, 'palestra', 'palestras')}`
    : `${plural(total, 'palestra', 'palestras')} ${ehAdmin() ? 'registradas' : 'suas'}`;
  document.getElementById('cabeca').innerHTML = tituloLinha(titulo, nota);

  document.getElementById('grade').innerHTML = eventos.length
    ? `<div class="grade">
        ${eventos.map((e) => `
          <a class="card-evento" href="#/evento/${encodeURIComponent(e.slug)}">
            ${elenco(e.instrutores, 3)}
            <div class="miolo">
              <div>
                ${tituloEvento(e, { ajustarAoNome: false })}
                <div class="ev-quem">${esc(quemNoPalco(e.instrutores))}</div>
              </div>
              ${metricasPalestra(e)}
            </div>
            <div class="barra-conv"><i style="width:${pct(e.conversao)}"></i></div>
          </a>`).join('')}
      </div>`
    : `<div class="vazio"><h3>Nenhuma palestra com esses filtros</h3>
        <p>Nenhum evento casa com a combinação escolhida. Troque um dos filtros
           ou <button class="como-link" type="button" id="limpar-vazio">limpe todos</button>.</p></div>`;

  document.getElementById('limpar-vazio')?.addEventListener('click', limparFiltros);

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
  return `<div class="aviso">${partes.join('. ')}. Vale cobrar a origem dos dados.
    ${s.atualizadoEm ? `<span class="quando">Dados de ${esc(horaCurta(s.atualizadoEm))}.</span>` : ''}</div>`;
}

// "há 3 min" é mais útil que um carimbo de data: o que se quer saber é se o
// número na tela é de agora ou de ontem.
function horaCurta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h atrás`;
  return d.toLocaleDateString('pt-BR');
}

/* ---------------- Evento ---------------- */

// O que o lead informa é onde a pessoa está no atendimento — e isso já está na
// coluna em que o card aparece.
function cardLead(l) {
  return `<div class="card-lead">
    <span class="ln">${esc(l.nome)}</span>
    <div class="tel">${l.telefone ? esc(mascararTelefone(l.telefone)) : 'sem telefone'}</div>
    <div class="email">${l.email ? esc(mascararEmail(l.email)) : 'sem email'}</div>
    ${rodapeLead(l)}
  </div>`;
}

// Check-in ainda não tem fonte confiável (docs/dados-que-faltam.md) — até
// `DataCheckin` existir em info_leads, todo card cai no "Sem check-in".
// Closer (atendente) já é dado de verdade: "Sem closer" quando ninguém pegou
// o lead ainda.
function rodapeLead(l) {
  return `<div class="rodape-lead">
    ${l.closer
      ? `<span class="closer">Closer: ${esc(l.closer)}</span>`
      : '<span class="closer sem-dado">Sem closer</span>'}
    ${l.checkinEm
      ? `<span class="checkin">Check-in ${esc(dataCurta(String(l.checkinEm).slice(0, 10)))}</span>`
      : '<span class="checkin sem-dado">Sem check-in</span>'}
  </div>`;
}

// Mostra as 4 primeiras letras do usuário e o domínio inteiro. Usuário com 4
// letras ou menos mascara tudo — nunca revela 100% do usuário, mesmo curto.
function mascararEmail(email) {
  const s = String(email ?? '').trim();
  if (!s) return '';
  const [user, dominio] = s.split('@');
  if (!user) return s;
  const visivel = user.length > 4 ? user.slice(0, 4) : '';
  const escondido = '•'.repeat(Math.max(user.length - visivel.length, 1));
  return visivel + escondido + (dominio ? '@' + dominio : '');
}

// Só os 4 últimos dígitos ficam visíveis — o resto (DDI, DDD, o número quase
// todo) vira ponto, no padrão de "termina em ####" de app bancário.
function mascararTelefone(tel) {
  const s = String(tel ?? '');
  if (s.length <= 4) return s;
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Nome é busca parcial — já aparece inteiro na tela, não tem o que proteger.
// Telefone e e-mail exigem o valor INTEIRO: são mascarados no cartão, e busca
// parcial deixaria alguém ir testando dígito por dígito até achar a pessoa.
function leadCombinaBusca(l, termoBruto) {
  const termo = String(termoBruto ?? '').trim();
  if (!termo) return true;
  const peloNome = semAcento(l.nome).includes(semAcento(termo));
  const digitos = soDigitos(termo);
  const peloTelefone = digitos.length > 0 && digitos === soDigitos(l.telefone);
  const peloEmail = termo.toLowerCase() === String(l.email ?? '').trim().toLowerCase();
  return peloNome || peloTelefone || peloEmail;
}

function renderKanban() {
  const { detalhe: d, etapaAberta, buscaLead } = estado;
  const porColuna = d.colunas.map((c) => c.leads.filter((l) => leadCombinaBusca(l, buscaLead)));
  const buscando = buscaLead.trim().length > 0;

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
          || `<p class="coluna-vazia">${buscando ? 'Nenhum lead bate com a busca' : 'Nenhum lead nesta etapa'}</p>`}
      </div>
    </div>`).join('');

  document.querySelectorAll('#chips button').forEach((b) => {
    b.addEventListener('click', () => { estado.etapaAberta = Number(b.dataset.etapa); renderKanban(); });
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
  estado = { detalhe: d, etapaAberta: 0, buscaLead: '' };
  const admin = ehAdmin();

  app.innerHTML = `
    <a class="voltar" href="#/">← Palestras</a>
    <div class="faixa-evento">
      ${elenco(d.instrutores, 1)}
      <div class="miolo">
        <div>
          ${tituloEvento(d)}
          <div class="ev-quem">${esc(quemNoPalco(d.instrutores))}</div>
        </div>
        ${metricasPalestra(d, { comLeads: false })}
      </div>
    </div>

    <div class="painel numeros">
      <div class="bloco">
        <span class="rotulo">Presença</span>
        <!-- O check-in de lead é o número do palestrante: é dessa gente que sai
             o trabalho dele depois do evento. Tribo e aldeia já eram casa, e o
             geral é a soma dos três — os dois viraram apoio. -->
        <div class="metricas">
          <span class="metrica"><b>${d.presentesLead}</b> check-in de leads</span>
          <span class="metrica conv"><b>${pct(d.pctPresenca)}</b> presentes</span>
        </div>
        <div class="metricas menor">
          <span class="metrica"><b>${d.cadastrados}</b> cadastrados</span>
          <span class="metrica"><b>${d.presentes}</b> check-in geral</span>
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
      <div class="bloco">
        <span class="rotulo">Leads</span>
        <div class="metricas">
          <span class="metrica"><b>${d.leads}</b> ${d.leads === 1 ? 'lead' : 'leads'}</span>
        </div>
      </div>
    </div>

    <div class="painel quadro-cabeca">
      ${admin
        ? tituloLinha('Quadro', 'onde cada lead está no atendimento')
        : tituloLinha('Seus leads', 'onde cada um está no atendimento')}
      ${buscaLeadHtml()}
    </div>

    <div id="chips" class="chips"></div>
    <div id="kanban" class="kanban"></div>`;

  tratarFotosQuebradas(app);
  document.getElementById('busca-lead').addEventListener('input', (ev) => {
    estado.buscaLead = ev.target.value;
    renderKanban();
  });
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

/* ---------------- Admin: pipelines do CRM ---------------- */

// Cadastro manual porque a UnniAPI não tem endpoint de listagem de pipeline/
// coluna (confirmado com o suporte) — sem isto, cidade nova exigia editar
// arquivo e mexer no código pra reconciliação enxergar o pipeline.
function linhaCrmPipeline(l) {
  return `<tr data-id="${l.id}">
    <td>${esc(l.pipeline_nome)}</td>
    <td class="mono">${esc(l.pipeline_id)}</td>
    <td>${esc(l.etapa_nome)}</td>
    <td class="mono">${esc(l.coluna_id)}</td>
    <td><button class="botao discreto" data-acao="remover">Remover</button></td>
  </tr>`;
}

async function telaCrmPipelines() {
  if (!ehAdmin()) { location.hash = '#/'; return; }
  app.innerHTML = esqueleto();

  let linhas;
  try { linhas = await pedir('/api/admin/crm-pipelines'); }
  catch (e) {
    app.innerHTML = `<div class="vazio"><h3>Não foi possível carregar</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  const porPipeline = new Map();
  for (const l of linhas) {
    if (!porPipeline.has(l.pipeline_nome)) porPipeline.set(l.pipeline_nome, []);
    porPipeline.get(l.pipeline_nome).push(l);
  }

  app.innerHTML = `
    <a class="voltar" href="#/">← Eventos</a>
    <div style="margin-top:22px">
      ${tituloLinha('Pipelines CRM', `${plural(porPipeline.size, 'pipeline cadastrado', 'pipelines cadastrados')}`)}
    </div>

    <div class="aviso">
      A UnniAPI não tem como listar pipeline/coluna — os IDs abaixo precisam ser
      copiados manualmente da interface do Unnichat. Alimentam a reconciliação
      que busca leads que o webhook perdeu.
    </div>

    <div class="painel">
      <h3>Nova coluna</h3>
      <form id="novo-crm">
        <div class="linha-form">
          <label class="campo"><span>Pipeline (nome)</span>
            <input type="text" name="pipelineNome" placeholder="Presencial Cidade - [ddmm] SIGLA" required></label>
          <label class="campo"><span>Pipeline ID</span><input type="text" name="pipelineId" required></label>
          <label class="campo"><span>Etapa (nome)</span><input type="text" name="etapaNome" required></label>
          <label class="campo"><span>Coluna ID</span><input type="text" name="colunaId" required></label>
        </div>
        <p class="erro" id="erro-novo-crm" role="alert"></p>
        <button class="botao" type="submit">Cadastrar</button>
      </form>
    </div>

    <div class="painel">
      <h3>Cadastrados</h3>
      <table class="tabela">
        <thead><tr><th>Pipeline</th><th>Pipeline ID</th><th>Etapa</th><th>Coluna ID</th><th></th></tr></thead>
        <tbody>${linhas.map(linhaCrmPipeline).join('') || '<tr><td colspan="5">Nenhum pipeline cadastrado ainda.</td></tr>'}</tbody>
      </table>
    </div>`;

  document.getElementById('novo-crm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = document.getElementById('erro-novo-crm');
    erro.textContent = '';
    const d = new FormData(ev.target);
    try {
      await pedir('/api/admin/crm-pipelines', {
        method: 'POST',
        body: JSON.stringify({
          pipelineNome: d.get('pipelineNome'), pipelineId: d.get('pipelineId'),
          etapaNome: d.get('etapaNome'), colunaId: d.get('colunaId'),
        }),
      });
      telaCrmPipelines();
    } catch (e) { erro.textContent = e.message; }
  });

  app.querySelectorAll('tr[data-id] [data-acao="remover"]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const id = Number(botao.closest('tr').dataset.id);
      try {
        await pedir(`/api/admin/crm-pipelines/${id}`, { method: 'DELETE' });
        telaCrmPipelines();
      } catch (e) { alert(e.message); }
    });
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
  if (hash === '#/crm-pipelines') return telaCrmPipelines();
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
