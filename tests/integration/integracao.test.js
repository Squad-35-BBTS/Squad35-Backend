const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const segredo =
  "segredo-exclusivo-dos-testes-de-integracao-123456";

process.env.JWT_SECRET = segredo;

const usuarios = [
  {
    id_usuario: 1,
    nome: "Gestor",
    email: "gestor@teste.local",
    perfil: "Gestor P&D / Lei do Bem",
    senha: "hash-privado",
  },
  {
    id_usuario: 2,
    nome: "Analista",
    email: "analista@teste.local",
    perfil: "Analista P&D",
    senha: "hash-privado",
  },
];

function selecionar(usuario, select) {
  if (!usuario) return null;

  return Object.fromEntries(
    Object.keys(select)
      .filter((campo) => select[campo])
      .map((campo) => [campo, usuario[campo]])
  );
}

const logs = Array.from({ length: 5 }, (_, i) => ({
  id_auditoria: 5 - i,
  acao: "CRIAR",
  usuario_id: 1,
  entidade: "Iniciativa",
  registro_id: "1",
  criado_em: new Date(),
}));

const db = {
  usuario: {
    findUnique: async ({ where, select }) =>
      selecionar(
        usuarios.find(
          (usuario) => usuario.id_usuario === where.id_usuario
        ),
        select
      ),

    findMany: async ({ select }) =>
      usuarios.map((usuario) => selecionar(usuario, select)),
  },

  auditoria: {
    count: async () => logs.length,

    findMany: async ({ skip, take }) =>
      logs.slice(skip, skip + take),
  },
};

db.$transaction = async (fn) => fn(db);

const caminho = require.resolve("../src/services/prisma");

require.cache[caminho] = {
  id: caminho,
  filename: caminho,
  loaded: true,
  exports: db,
};

const app = require("../src/server");

let servidor;
let base;

before(async () => {
  servidor = app.listen(0, "127.0.0.1");

  await new Promise((resolve) =>
    servidor.once("listening", resolve)
  );

  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(
  () => new Promise((resolve) => servidor.close(resolve))
);

async function get(path, usuarioId) {
  const headers = usuarioId
    ? {
        Authorization: `Bearer ${jwt.sign(
          { id_usuario: usuarioId },
          segredo
        )}`,
      }
    : {};

  const resposta = await fetch(base + path, { headers });

  return {
    status: resposta.status,
    body: await resposta.json(),
  };
}

test("usuário atual exige autenticação", async () => {
  assert.equal((await get("/auth/me")).status, 401);
});

test("usuário atual não expõe senha", async () => {
  const resposta = await get("/auth/me", 1);

  assert.equal(resposta.status, 200);
  assert.equal(resposta.body.usuario.nome, "Gestor");
  assert.equal(resposta.body.usuario.senha, undefined);
});

test("lista de responsáveis não expõe hashes", async () => {
  const resposta = await get("/usuarios", 1);

  assert.equal(resposta.status, 200);
  assert.equal(resposta.body.length, 2);

  assert.equal(
    JSON.stringify(resposta.body).includes("hash-privado"),
    false
  );
});

test("analista não pode consultar auditoria", async () => {
  assert.equal((await get("/auditoria", 2)).status, 403);
});

test("auditoria pagina resultados e retorna total", async () => {
  const resposta = await get(
    "/auditoria?pagina=2&limite=2",
    1
  );

  assert.equal(resposta.status, 200);

  assert.deepEqual(
    resposta.body.dados.map((item) => item.id_auditoria),
    [3, 2]
  );

  assert.equal(resposta.body.paginacao.total, 5);
  assert.equal(resposta.body.paginacao.total_paginas, 3);
});

test("auditoria recusa limite excessivo e campos desconhecidos", async () => {
  assert.equal(
    (await get("/auditoria?limite=101", 1)).status,
    400
  );

  assert.equal(
    (await get("/auditoria?senha=abc", 1)).status,
    400
  );
});