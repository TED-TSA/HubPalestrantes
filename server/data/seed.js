import * as usuarios from './usuarios.js';
import { senhaAceitavel } from '../auth/senha.js';
import { config } from '../../config.js';

// No Cloud Run o disco é efêmero: usuários criados pela tela somem a cada
// restart. Para o login não ficar inacessível num protótipo, um admin é semeado
// no boot a partir de ADMIN_EMAIL / ADMIN_SENHA (e ADMIN_NOME opcional).
//
// Idempotente: se o admin já existe nesta instância, não mexe. Sem as variáveis,
// não faz nada — o comportamento local (npm run criar-admin) segue igual.
export async function semearAdmin(db) {
  const email = usuarios.normalizarEmail(process.env.ADMIN_EMAIL);
  const senha = String(process.env.ADMIN_SENHA ?? '');
  if (!email || !senha) return null;

  if (!usuarios.emailDoDominio(email)) {
    console.error(`[seed admin] ADMIN_EMAIL precisa ser @${config.dominioPermitido}; ignorado.`);
    return null;
  }
  if (!senhaAceitavel(senha)) {
    console.error('[seed admin] ADMIN_SENHA precisa ter ao menos 8 caracteres; ignorado.');
    return null;
  }
  if (await usuarios.porEmail(db, email)) return null;

  const nome = String(process.env.ADMIN_NOME ?? '').trim() || 'Administrador';
  const admin = await usuarios.criar(db, { email, nome, senha, papel: 'admin' });
  // Não exige troca de senha: num protótipo efêmero a troca não sobreviveria ao
  // restart e só travaria o acesso na próxima subida.
  await db.execute({ sql: 'UPDATE usuarios SET precisa_trocar_senha = 0 WHERE id = ?', args: [admin.id] });
  console.log(`[seed admin] ${email} criado como admin.`);
  return admin;
}
