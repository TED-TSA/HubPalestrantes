// Cria (ou promove) o primeiro admin. Sem isto haveria o problema do ovo e da
// galinha: a tela de cadastro exige estar logado como admin.
//
//   npm run criar-admin
//
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { bancoPadrao } from '../server/data/db.js';
import * as usuarios from '../server/data/usuarios.js';
import { senhaAceitavel } from '../server/auth/senha.js';

const rl = createInterface({ input: stdin, output: stdout });

try {
  const email = usuarios.normalizarEmail(await rl.question('Email do admin: '));
  if (!usuarios.emailDoDominio(email)) {
    console.error('\nO email precisa terminar em @tradestars.com.br.');
    process.exit(1);
  }
  const nome = (await rl.question('Nome: ')).trim();
  const senha = await rl.question('Senha (mínimo 8 caracteres): ');
  if (!senhaAceitavel(senha)) {
    console.error('\nSenha muito curta.');
    process.exit(1);
  }

  const db = await bancoPadrao();
  const existente = await usuarios.porEmail(db, email);
  if (existente) {
    await usuarios.atualizar(db, existente.id, { nome: nome || existente.nome, papel: 'admin', ativo: true });
    await usuarios.resetarSenha(db, existente.id, senha);
    console.log(`\nUsuário ${email} promovido a admin e senha redefinida.`);
  } else {
    await usuarios.criar(db, { email, nome, senha, papel: 'admin' });
    console.log(`\nAdmin ${email} criado.`);
  }
  console.log('Ele vai precisar trocar a senha no primeiro acesso.');
} finally {
  rl.close();
}
