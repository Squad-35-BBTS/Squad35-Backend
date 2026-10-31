require('dotenv').config();
const bcrypt = require('bcryptjs');

async function seed(prisma) {
  const nome = (process.env.SEED_USER_NAME || '').trim();
  const email = (process.env.SEED_USER_EMAIL || '').trim().toLowerCase();
  const senha = process.env.SEED_USER_PASSWORD || '';
  if (!nome || nome.length > 191 || email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 10 || Buffer.byteLength(senha, 'utf8') > 72) {
    throw new Error('Configure SEED_USER_NAME, SEED_USER_EMAIL e SEED_USER_PASSWORD (10 caracteres a 72 bytes) no .env.');
  }
  const existente = await prisma.usuario.findUnique({ where: { email }, select: { id_usuario: true } });
  if (existente) {
    console.log('Usuário já cadastrado; senha, perfil e dados preservados.');
    return;
  }
  await prisma.usuario.create({ data: {
    nome, email, senha: await bcrypt.hash(senha, 12), perfil: 'Gestor P&D / Lei do Bem',
  } });
  console.log('Gestor inicial criado. Nenhum registro anterior foi removido.');
}

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  seed(prisma)
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
module.exports = seed;
