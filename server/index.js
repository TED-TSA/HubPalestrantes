import { criarApp } from './app.js';
import { config } from '../config.js';

const app = criarApp();
app.listen(config.port, () => {
  console.log(`Hub do Palestrante em http://localhost:${config.port}`);
});
