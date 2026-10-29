const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = {};
let estado;

const caminho = require.resolve("../src/services/prisma");

require.cache[caminho] = {
  id: caminho,
  filename: caminho,
  loaded: true,
  exports: db,
};

const despesas = require("../src/controllers/dispendioController");
const horas = require("../src/controllers/timesheetController");

beforeEach(() => {
  estado = {
    projeto: {
      id_iniciativa: 1,
      ano_base: 2026,
      status_dossie: "Aberto",
      revisao: 1,
    },

    despesas: [
      {
        id_dispendio: 1,
        iniciativa_id: 1,
        descricao: "Teste",
        categoria: "Infraestrutura",
        data: new Date("2026-10-01"),
        valor: "10.00",
      },
    ],

    horas: [
      {
        id_timesheet: 1,
        iniciativa_id: 1,
        colaborador_id: "COL-01",
        colaborador_nome: "Pessoa",
        cargo_regime: "CLT",
        data: new Date("2026-10-01"),
        horas_mes: "8.50",
        elegivel_pct: "100.00",
        custo_apropriado: "100.00",
        justificativa: "Experimento",
        status: "Pendente",
      },
    ],

    logs: [],
  };

  // Simulação de transação para testar os caminhos de falha.
  db.$transaction = async (fn) => {
    const antes = structuredClone(estado);

    try {
      return await fn(db);
    } catch (error) {
      estado = antes;
      throw error;
    }
  };

  db.iniciativa = {
    findUnique: async ({ where }) =>
      where.id_iniciativa === 1
        ? estado.projeto
        : null,

    update: async () => {
      estado.projeto.revisao++;
      return estado.projeto;
    },
  };

  db.auditoria = {
    create: async ({ data }) => {
      estado.logs.push(data);
      return data;
    },
  };

  const modelos = [
    ["dispendio", "despesas", "id_dispendio"],
    ["timesheet", "horas", "id_timesheet"],
  ];

  for (const [modelo, tabela, chave] of modelos) {
    db[modelo] = {
      findUnique: async ({ where }) =>
        estado[tabela].find(
          (r) => r[chave] === where[chave]
        ) || null,

      findMany: async ({ where }) =>
        estado[tabela].filter((r) => {
          if (
            where.iniciativa_id !== undefined &&
            r.iniciativa_id !== where.iniciativa_id
          ) {
            return false;
          }

          if (
            where.colaborador_id !== undefined &&
            r.colaborador_id !== where.colaborador_id
          ) {
            return false;
          }

          return (
            !where.data ||
            (
              r.data >= where.data.gte &&
              r.data < where.data.lt
            )
          );
        }),

      create: async ({ data }) => {
        const r = {
          [chave]: estado[tabela].length + 1,
          ...data,
        };

        estado[tabela].push(r);
        return r;
      },

      update: async ({ where, data }) => {
        const r = estado[tabela].find(
          (item) => item[chave] === where[chave]
        );

        Object.assign(r, data);

        return { ...r };
      },
    };
  }
});

function req(extra = {}) {
  return {
    params: {
      iniciativaId: "1",
      dispendioId: "1",
      timesheetId: "1",
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
  };
}

function inesperado(error) {
  throw error;
}

const gestor = {
  usuarioPerfil: "Gestor P&D / Lei do Bem",
};

function despesa() {
  return {
    descricao: "Infraestrutura",
    categoria: "Infraestrutura",
    valor: "250.50",
    data: "2026-10-29",
  };
}

function timesheet() {
  return {
    colaborador_id: "COL-01",
    colaborador_nome: "Pessoa",
    cargo_regime: "CLT",
    data: "2026-10-29",
    horas_mes: 12.5,
    elegivel_pct: 100,
    custo_apropriado: "250.50",
    justificativa: "Execução do experimento",
  };
}

test(
  "dispêndio guarda duas casas e registra auditoria",
  async () => {
    const r = res();

    await despesas.criarDispendio(
      req({ body: despesa() }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 201);
    assert.equal(r.body.valor, "250.50");
    assert.equal(estado.logs[0].usuario_id, 7);
    assert.equal(estado.projeto.revisao, 2);
  }
);

test(
  "dispêndio recusa valor inválido, data inexistente e outro ano",
  async () => {
    const exemplos = [
      { valor: -1 },
      { valor: 0 },
      { valor: 1.234 },
      { data: "2026-02-30" },
      { data: "2025-10-01" },
    ];

    for (const patch of exemplos) {
      const r = res();

      await despesas.criarDispendio(
        req({
          body: { ...despesa(), ...patch },
        }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }

    assert.equal(estado.despesas.length, 1);
  }
);

test(
  "projeto sem ano-base impede lançamento",
  async () => {
    estado.projeto.ano_base = null;

    const r = res();

    await despesas.criarDispendio(
      req({ body: despesa() }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 409);
  }
);

test(
  "dossiê fechado impede valores, horas e aprovação",
  async () => {
    estado.projeto.status_dossie = "Fechado";

    const operacoes = [
      [despesas, "criarDispendio", despesa()],
      [horas, "criarTimesheet", timesheet()],
      [horas, "aprovarLote", { ids: [1] }],
    ];

    for (const [controller, metodo, body] of operacoes) {
      const r = res();

      await controller[metodo](
        req({ ...gestor, body }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 409);
    }
  }
);

test(
  "não permite editar despesa de outro projeto",
  async () => {
    estado.despesas[0].iniciativa_id = 99;

    const r = res();

    await despesas.atualizarDispendio(
      req({ body: { valor: 20 } }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 404);
  }
);

test(
  "edição de dispêndio permite limpar referência documental",
  async () => {
    const r = res();

    await despesas.atualizarDispendio(
      req({
        body: {
          valor: 20,
          documento_comprobatorio: null,
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.valor, "20.00");
    assert.equal(r.body.documento_comprobatorio, null);
  }
);

test(
  "horas fracionadas começam pendentes",
  async () => {
    const r = res();

    await horas.criarTimesheet(
      req({ body: timesheet() }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 201);
    assert.equal(r.body.horas_mes, "12.50");
    assert.equal(r.body.status, "Pendente");
    assert.equal(r.body.aprovado_por_id, null);
  }
);

test(
  "cliente não pode enviar aprovação no cadastro",
  async () => {
    const r = res();

    await horas.criarTimesheet(
      req({
        body: {
          ...timesheet(),
          status: "Aprovado pelo Gestor",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 400);
  }
);

test(
  "horas validam percentual, custo, precisão e justificativa",
  async () => {
    const exemplos = [
      { elegivel_pct: 101 },
      { custo_apropriado: -1 },
      { horas_mes: 0 },
      { horas_mes: 1.234 },
      { justificativa: "" },
    ];

    for (const patch of exemplos) {
      const r = res();

      await horas.criarTimesheet(
        req({
          body: { ...timesheet(), ...patch },
        }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }
  }
);

test(
  "limite mensal soma registros de outros projetos",
  async () => {
    estado.horas[0].data = new Date("2026-02-01");
    estado.horas[0].horas_mes = "670";
    estado.horas[0].iniciativa_id = 99;

    const r = res();

    await horas.criarTimesheet(
      req({
        body: {
          ...timesheet(),
          data: "2026-02-10",
          horas_mes: 3,
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 409);
  }
);

test(
  "edição exige nova aprovação e não soma o próprio registro duas vezes",
  async () => {
    Object.assign(estado.horas[0], {
      status: "Aprovado pelo Gestor",
      aprovado_por_id: 7,
      aprovado_em: new Date(),
      horas_mes: "700",
    });

    const r = res();

    await horas.atualizarTimesheet(
      req({
        body: { horas_mes: 701 },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.status, "Pendente");
    assert.equal(r.body.aprovado_por_id, null);
    assert.equal(r.body.aprovado_em, null);
  }
);

test(
  "analista não aprova horas",
  async () => {
    const r = res();

    await horas.aprovarLote(
      req({ body: { ids: [1] } }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 403);
  }
);

test(
  "gestor aprova com autor, data e auditoria",
  async () => {
    const r = res();

    await horas.aprovarLote(
      req({
        ...gestor,
        body: { ids: [1] },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.aprovados[0].aprovado_por_id, 7);

    assert.ok(
      r.body.aprovados[0].aprovado_em instanceof Date
    );

    assert.equal(estado.logs[0].acao, "APROVAR");
  }
);

test(
  "falha no lote reverte aprovações, auditoria e revisão no dublê",
  async () => {
    const r = res();

    await horas.aprovarLote(
      req({
        ...gestor,
        body: { ids: [1, 999] },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 404);
    assert.equal(estado.horas[0].status, "Pendente");
    assert.equal(estado.logs.length, 0);
    assert.equal(estado.projeto.revisao, 1);
  }
);

test(
  "lote recusa IDs duplicados, vazio e registro sem justificativa",
  async () => {
    for (const ids of [[], [1, 1]]) {
      const r = res();

      await horas.aprovarLote(
        req({
          ...gestor,
          body: { ids },
        }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }

    estado.horas[0].justificativa = null;

    const r = res();

    await horas.aprovarLote(
      req({
        ...gestor,
        body: { ids: [1] },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 409);
  }
);

test(
  "falha de auditoria não deixa lançamento parcial no dublê",
  async () => {
    db.auditoria.create = async () => {
      throw new Error("Falha interna de auditoria");
    };

    let erro;

    await despesas.criarDispendio(
      req({ body: despesa() }),
      res(),
      (e) => {
        erro = e;
      }
    );

    assert.equal(
      erro.message,
      "Falha interna de auditoria"
    );

    assert.equal(estado.despesas.length, 1);
    assert.equal(estado.projeto.revisao, 1);
  }
);