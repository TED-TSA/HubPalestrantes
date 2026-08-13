import { criarApp } from './app.js';
import { carregarTudo } from './data/repository.js';
import { runQuery } from './data/bq.js';
import { config } from '../config.js';

const app = criarApp();
app.listen(config.port, () => {
  console.log(`Hub do Palestrante em http://localhost:${config.port}`);

  // Aquece o cache assim que o servidor sobe. Sem isto, a primeira pessoa a
  // abrir o Hub no dia paga os ~15s das consultas sozinha, olhando o esqueleto.
  const inicio = Date.now();
  carregarTudo({ runQuery })
    .then(({ palestras, descartados }) => {
      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(`Dados prontos em ${segundos}s — ${palestras.length} palestras`
        + (descartados ? `, ${descartados} leads descartados na origem` : ''));
    })
    .catch((e) => console.error('Falha ao aquecer o cache:', e.message));
});
