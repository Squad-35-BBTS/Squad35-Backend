const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123', 8);
  
  await prisma.usuario.upsert({
    where: { email: 'carlos.lima@empresa.com' },
    update: {},
    create: {
      id_usuario: 1,
      nome: 'Carlos Lima',
      email: 'carlos.lima@empresa.com',
      senha: hashedPassword,
      perfil: 'Gestor Lei do Bem'
    },
  });
  console.log('Seed executado com sucesso: Utilizador padrão criado!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });