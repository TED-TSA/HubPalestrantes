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
