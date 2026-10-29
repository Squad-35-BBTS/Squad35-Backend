const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const db = {};

let p;
let m;
let e;
let documentos;
let eventos;

// Estes testes substituem o Prisma e não acessam o MySQL.
const caminho = require.resolve("../src/services/prisma");

require.cache[caminho] = {
  id: caminho,
  filename: caminho,
  loaded: true,
  exports: db,
};

const controller = require("../src/controllers/marcoController");

function selecionar(row, select) {
  if (!select) return { ...row };

  return Object.fromEntries(
    Object.keys(select)
      .filter((k) => select[k])
      .map((k) => [k, row[k]])
  );
}

beforeEach(() => {
  p = {
    id_iniciativa: 1,
    status_dossie: "Aberto",
  };

  m = {
    id_marco: 2,
    iniciativa_id: 1,
    status_validacao: "Pendente",
  };

  const bytes = Buffer.from("Documento experimental");

  e = {
    id_evidencia: 5,
    marco_id: 2,
    nome: "teste.txt",
    conteudo: bytes,
    tamanho_bytes: bytes.length,
    sha256: crypto
      .createHash("sha256")
      .update(bytes)
      .digest("hex"),
    status: "Pendente",
  };

  documentos = [];
  eventos = [];

  db.$transaction = async (fn) => fn(db);

  db.iniciativa = {
    findUnique: async () => p,

    update: async (args) => {
      eventos.push(args.data);
      return p;
    },
  };

  db.marcoExperimento = {
    findUnique: async () => m,
    findMany: async () => [],

    create: async ({ data }) => ({
      id_marco: 2,
      ...data,
    }),

    update: async ({ data }) => {
      Object.assign(m, data);
      return { ...m };
    },
  };

  db.evidencia = {
    findUnique: async () => e,
    findMany: async () => documentos,

    create: async ({ data, select }) => {
      Object.assign(e, data);
      return selecionar(e, select);
    },

    update: async ({ data, select }) => {
      Object.assign(e, data);
      return selecionar(e, select);
    },
  };

  db.auditoria = {
    create: async ({ data }) => {
      eventos.push(data);
      return data;
    },
  };
});

function req(extra = {}) {
  return {
    params: {
      iniciativaId: "1",
      marcoId: "2",
      evidenciaId: "5",
    },
    body: {},
    usuarioId: 7,
    usuarioPerfil: "Analista P&D",
    ...extra,
  };
}

function res() {
  return {
    statusCode: 200,

    status(n) {
      this.statusCode = n;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },

    set(headers) {
      this.headers = headers;
      return this;
    },

    send(body) {
      this.body = body;
      return this;
    },
  };
}

function inesperado(error) {
  throw error;
}

const gestor = {
  usuarioPerfil: "Gestor P&D / Lei do Bem",
};

const novoMarco = {
  titulo: "PoC",
  periodo: "Out/2026",
  descricao: "Teste da hipótese",
};

test(
  "marco começa pendente e registra auditoria e revisão",
  async () => {
    const r = res();

    await controller.criarMarco(
      req({ body: novoMarco }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 201);
    assert.equal(r.body.status_validacao, "Pendente");

    assert.deepEqual(
      eventos[0].revisao,
      { increment: 1 }
    );

    assert.equal(eventos[1].usuario_id, 7);
  }
);

test(
  "cliente não pode cadastrar marco já validado",
  async () => {
    const r = res();

    await controller.criarMarco(
      req({
        body: {
          ...novoMarco,
          status_validacao: "Validado",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 400);
    assert.equal(eventos.length, 0);
  }
);

test(
  "dossiê fechado impede criação e anexo",
  async () => {
    p.status_dossie = "Fechado";

    const operacoes = [
      ["criarMarco", novoMarco],
      [
        "anexarEvidencia",
        {
          nome: "a.txt",
          conteudo_base64: "YQ==",
        },
      ],
    ];

    for (const [metodo, body] of operacoes) {
      const r = res();

      await controller[metodo](
        req({ body }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 409);
    }
  }
);

test(
  "anexo calcula SHA-256, omite bytes e invalida aprovação do marco",
  async () => {
    m.status_validacao = "Validado";
    m.validado_por_id = 7;

    const bytes = Buffer.from("Nova evidência");
    const r = res();

    await controller.anexarEvidencia(
      req({
        body: {
          nome: "relatorio.txt",
          conteudo_base64: bytes.toString("base64"),
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 201);

    assert.equal(
      r.body.sha256,
      crypto
        .createHash("sha256")
        .update(bytes)
        .digest("hex")
    );

    assert.equal(r.body.conteudo, undefined);
    assert.equal(m.status_validacao, "Pendente");
    assert.equal(m.validado_por_id, null);
  }
);

test(
  "recusa nome com caminho e base64 inválido",
  async () => {
    const exemplos = [
      {
        nome: "../a.txt",
        conteudo_base64: "YQ==",
      },
      {
        nome: "a.txt",
        conteudo_base64: "!!!",
      },
      {
        nome: "a.txt",
        conteudo_base64: "YQ=A",
      },
    ];

    for (const body of exemplos) {
      const r = res();

      await controller.anexarEvidencia(
        req({ body }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }
  }
);

test(
  "recusa marco pertencente a outro projeto",
  async () => {
    m.iniciativa_id = 99;

    const r = res();

    await controller.anexarEvidencia(
      req({
        body: {
          nome: "a.txt",
          conteudo_base64: "YQ==",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 404);
  }
);

test(
  "analista não valida documento nem marco",
  async () => {
    for (const metodo of [
      "validarEvidencia",
      "validarMarco",
    ]) {
      const r = res();

      await controller[metodo](
        req(),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 403);
    }
  }
);

test(
  "documento adulterado não pode ser validado",
  async () => {
    e.conteudo = Buffer.from("Adulterado");

    const r = res();

    await controller.validarEvidencia(
      req(gestor),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 409);
  }
);

test(
  "validação registra gestor e data sem retornar os bytes",
  async () => {
    const r = res();

    await controller.validarEvidencia(
      req(gestor),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.status, "Validado");
    assert.equal(r.body.validado_por_id, 7);
    assert.ok(r.body.validado_em instanceof Date);
    assert.equal(r.body.conteudo, undefined);
  }
);

test(
  "marco exige evidências validadas com autor e data",
  async () => {
    const a = res();

    await controller.validarMarco(
      req(gestor),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 409);

    documentos = [
      { status: "Validado" },
    ];

    const b = res();

    await controller.validarMarco(
      req(gestor),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);

    documentos = [
      {
        status: "Validado",
        validado_por_id: 7,
        validado_em: new Date(),
      },
    ];

    const c = res();

    await controller.validarMarco(
      req(gestor),
      c,
      inesperado
    );

    assert.equal(c.statusCode, 200);
    assert.equal(c.body.validado_por_id, 7);
  }
);

test(
  "editar marco exige nova validação",
  async () => {
    m.status_validacao = "Validado";

    const r = res();

    await controller.atualizarMarco(
      req({
        body: {
          descricao: "Experimento revisado",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.body.status_validacao, "Pendente");
    assert.equal(r.body.validado_por_id, null);
  }
);

test(
  "download devolve bytes como anexo",
  async () => {
    const r = res();

    await controller.baixarEvidencia(
      req(),
      r,
      inesperado
    );

    assert.deepEqual(r.body, e.conteudo);

    assert.equal(
      r.headers["X-Content-Type-Options"],
      "nosniff"
    );

    assert.match(
      r.headers["Content-Disposition"],
      /attachment/
    );
  }
);

test(
  "aceita exatamente 5 MiB e recusa tamanho superior",
  async () => {
    const a = res();

    await controller.anexarEvidencia(
      req({
        body: {
          nome: "limite.bin",
          conteudo_base64: Buffer.alloc(
            5 * 1024 * 1024
          ).toString("base64"),
        },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 201);
    assert.equal(
      a.body.tamanho_bytes,
      5 * 1024 * 1024
    );

    const b = res();

    await controller.anexarEvidencia(
      req({
        body: {
          nome: "grande.bin",
          conteudo_base64: Buffer.alloc(
            5 * 1024 * 1024 + 1
          ).toString("base64"),
        },
      }),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 400);
  }
);