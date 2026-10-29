const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Segredo fictício, exclusivo deste processo de testes.
process.env.JWT_SECRET =
  "segredo-ficticio-exclusivo-dos-testes-123456789";

let usuarios = [];
let proximoId = 1;

function selecionar(usuario, select) {
  if (!usuario) return null;

  if (!select) {
    return { ...usuario };
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, incluir]) => incluir)
      .map(([campo]) => [campo, usuario[campo]])
  );
}

// Substitui o Prisma por um dublê.
// Estes testes não acessam nem alteram seu banco.
const prismaFake = {
  usuario: {
    async findUnique({ where, select }) {
      const usuario = usuarios.find((item) => {
        return Object.entries(where).every(
          ([campo, valor]) => item[campo] === valor
        );
      });

      return selecionar(usuario, select);
    },

    async create({ data, select }) {
      if (usuarios.some((item) => item.email === data.email)) {
        const erro = new Error("E-mail duplicado.");
        erro.code = "P2002";
        throw erro;
      }

      const usuario = {
        id_usuario: proximoId++,
        ...data,
      };

      usuarios.push(usuario);

      return selecionar(usuario, select);
    },
  },
};

const caminhoPrisma = require.resolve("../src/services/prisma");

require.cache[caminhoPrisma] = {
  id: caminhoPrisma,
  filename: caminhoPrisma,
  loaded: true,
  exports: prismaFake,
};

const authController = require("../src/controllers/authController");
const authMiddleware = require("../src/Middleware/authMiddleware");

function criarResposta() {
  return {
    statusCode: 200,
    body: undefined,

    status(codigo) {
      this.statusCode = codigo;
      return this;
    },

    json(conteudo) {
      this.body = conteudo;
      return this;
    },
  };
}

function erroInesperado(error) {
  throw error;
}

async function criarUsuario() {
  return prismaFake.usuario.create({
    data: {
      nome: "Pessoa de Teste",
      email: "teste@exemplo.com",
      senha: await bcrypt.hash("senha-teste-123", 4),
      perfil: "Analista P&D",
    },
  });
}

beforeEach(() => {
  usuarios = [];
  proximoId = 1;
  process.env.ALLOW_PUBLIC_REGISTRATION = "false";
});

test("cadastro público desabilitado retorna 403", async () => {
  const res = criarResposta();

  await authController.register(
    { body: {} },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 403);
  assert.equal(usuarios.length, 0);
});

test("cadastro impede escolha de perfil privilegiado", async () => {
  process.env.ALLOW_PUBLIC_REGISTRATION = "true";

  const res = criarResposta();

  await authController.register(
    {
      body: {
        nome: "Pessoa",
        email: "pessoa@exemplo.com",
        senha: "senha-teste-123",
        perfil: "Administrador",
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 400);
  assert.equal(usuarios.length, 0);
});

test("cadastro armazena hash e não retorna a senha", async () => {
  process.env.ALLOW_PUBLIC_REGISTRATION = "true";

  const res = criarResposta();

  await authController.register(
    {
      body: {
        nome: "Pessoa",
        email: "pessoa@exemplo.com",
        senha: "senha-teste-123",
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.usuario.senha, undefined);
  assert.equal(res.body.usuario.perfil, "Analista P&D");

  assert.notEqual(usuarios[0].senha, "senha-teste-123");

  assert.equal(
    await bcrypt.compare("senha-teste-123", usuarios[0].senha),
    true
  );
});

test("login correto retorna token sem expor hash", async () => {
  const usuario = await criarUsuario();
  const res = criarResposta();

  await authController.login(
    {
      body: {
        email: "teste@exemplo.com",
        senha: "senha-teste-123",
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.usuario.senha, undefined);

  const payload = jwt.verify(
    res.body.token,
    process.env.JWT_SECRET,
    { algorithms: ["HS256"] }
  );

  assert.equal(payload.id_usuario, usuario.id_usuario);
});

test("senha incorreta retorna 401", async () => {
  await criarUsuario();
  const res = criarResposta();

  await authController.login(
    {
      body: {
        email: "teste@exemplo.com",
        senha: "senha-incorreta",
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.token, undefined);
});

test("requisição sem token retorna 401", async () => {
  const res = criarResposta();

  await authMiddleware(
    { headers: {} },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 401);
});

test("token assinado com outra chave retorna 401", async () => {
  const token = jwt.sign(
    { id_usuario: 1 },
    "outra-chave-que-nao-e-a-do-servidor"
  );

  const res = criarResposta();

  await authMiddleware(
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 401);
});

test("token expirado retorna 401", async () => {
  const token = jwt.sign(
    { id_usuario: 1 },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );

  const res = criarResposta();

  await authMiddleware(
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 401);
});

test("token de usuário inexistente retorna 401", async () => {
  const token = jwt.sign(
    { id_usuario: 999 },
    process.env.JWT_SECRET
  );

  const res = criarResposta();

  await authMiddleware(
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    res,
    erroInesperado
  );

  assert.equal(res.statusCode, 401);
});

test("middleware usa o perfil atual do banco", async () => {
  const usuario = await criarUsuario();

  const token = jwt.sign(
    {
      id_usuario: usuario.id_usuario,
      perfil: "Administrador",
    },
    process.env.JWT_SECRET
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  const res = criarResposta();
  let continuou = false;

  await authMiddleware(req, res, (error) => {
    if (error) throw error;
    continuou = true;
  });

  assert.equal(continuou, true);
  assert.equal(req.usuarioPerfil, "Analista P&D");
  assert.equal(req.usuario.senha, undefined);
});