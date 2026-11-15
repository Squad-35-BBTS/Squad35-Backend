require("dotenv").config();

const bcrypt = require("bcryptjs");

const contas = [
  {
    nome: "Carlos Drummond",
    email: "carlos.drummond@bbts.com",
    perfil: "Gestor P&D / Lei do Bem",
    variavelSenha: "SEED_GESTOR_PASSWORD",
  },
  {
    nome: "Lucas Almeida",
    email: "lucas.almeida@bbts.com",
    perfil: "Analista P&D",
    variavelSenha: "SEED_ANALISTA_PASSWORD",
  },
  {
    nome: "Mariana Costa",
    email: "mari.costa@bbts.com",
    perfil: "Auditor",
    variavelSenha: "SEED_AUDITOR_PASSWORD",
  },
  {
    nome: "Beatriz Santos",
    email: "bibia.santos@bbts.com",
    perfil: "Consultoria especializada",
    variavelSenha: "SEED_CONSULTORIA_PASSWORD",
  },
];

function validarSenha(senha, variavel) {
  if (
    typeof senha !== "string" ||
    senha.length < 10 ||
    Buffer.byteLength(senha, "utf8") > 72
  ) {
    throw new Error(
      `Configure ${variavel} no .env com uma senha ` +
      "de pelo menos 10 caracteres e até 72 bytes."
    );
  }
}

async function seed(prisma) {
  const preparados = [];

  // Valida todas as contas necessárias antes de gravar.
  for (const conta of contas) {
    const email = conta.email.trim().toLowerCase();

    const existente = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id_usuario: true,
        perfil: true,
      },
    });

    if (existente) {
      preparados.push({
        ...conta,
        email,
        senhaHash: null,
      });

      continue;
    }

    const senha = process.env[conta.variavelSenha];

    validarSenha(senha, conta.variavelSenha);

    preparados.push({
      ...conta,
      email,
      senhaHash: await bcrypt.hash(senha, 12),
    });
  }

  const mensagens = await prisma.$transaction(
    async (db) => {
      const resultados = [];

      for (const conta of preparados) {
        // Confere novamente dentro da transação.
        const existente = await db.usuario.findUnique({
          where: { email: conta.email },
          select: {
            id_usuario: true,
            perfil: true,
          },
        });

        if (existente) {
          resultados.push(
            `${conta.nome}: já cadastrado; ` +
            "senha e perfil preservados."
          );

          if (existente.perfil !== conta.perfil) {
            resultados.push(
              `Atenção: ${conta.nome} está com o perfil ` +
              `"${existente.perfil}", diferente do esperado ` +
              `"${conta.perfil}".`
            );
          }

          continue;
        }

        if (!conta.senhaHash) {
          throw new Error(
            `O cadastro de ${conta.nome} mudou durante ` +
            "a operação. Execute o seed novamente."
          );
        }

        await db.usuario.create({
          data: {
            nome: conta.nome,
            email: conta.email,
            perfil: conta.perfil,
            senha: conta.senhaHash,
          },
        });

        resultados.push(
          `${conta.nome}: criado como ${conta.perfil}.`
        );
      }

      return resultados;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  for (const mensagem of mensagens) {
    console.log(mensagem);
  }

  console.log(
    "Seed concluído. Projetos e usuários existentes preservados."
  );
}

if (require.main === module) {
  const { PrismaClient } = require("@prisma/client");

  const prisma = new PrismaClient();

  seed(prisma)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = seed;