const form = document.getElementById('form');
const erro = document.getElementById('erro');
const enviar = document.getElementById('enviar');
const rotulo = document.getElementById('rotulo');
const senha = document.getElementById('senha');
const olho = document.getElementById('olho');

// Um vídeo só, com um trecho de cada palestrante emendado — os cinco aparecem
// em toda visita. Vídeo só onde ele não atrapalha: tela grande, sem economia de
// dados e sem preferência por menos movimento. Nos outros casos fica o poster,
// que já é um frame do próprio vídeo — mesma imagem, sem baixar megabytes.
function ligarFundo() {
  const conexao = navigator.connection;
  const cara = conexao && (conexao.saveData || /(^|-)2g$/.test(conexao.effectiveType ?? ''));
  const grande = window.matchMedia('(min-width: 900px)').matches;
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!grande || quieto || cara) return;

  const video = document.getElementById('fundo');
  video.src = '/public/login/fundo.mp4';
  video.play().catch(() => {}); // autoplay bloqueado: o poster continua valendo
}

olho.addEventListener('click', () => {
  const mostrando = senha.type === 'text';
  senha.type = mostrando ? 'password' : 'text';
  olho.setAttribute('aria-pressed', String(!mostrando));
  olho.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  senha.focus();
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  erro.textContent = '';
  enviar.disabled = true;
  rotulo.textContent = 'Acessando…';

  const dados = new FormData(form);
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: dados.get('email'),
        senha: dados.get('senha'),
        manterConectado: dados.get('manter') === 'on',
      }),
    });
    if (res.ok) {
      location.href = '/';
      return;
    }
    const corpo = await res.json().catch(() => ({}));
    erro.textContent = corpo.erro ?? 'Não foi possível entrar. Tente de novo.';
  } catch {
    erro.textContent = 'Sem conexão com o servidor.';
  }
  enviar.disabled = false;
  rotulo.textContent = 'Acessar o Hub';
});

ligarFundo();
