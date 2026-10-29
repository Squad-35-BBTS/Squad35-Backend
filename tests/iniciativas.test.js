const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = {};
let gravacoes;

// Impede que estes testes usem o MySQL real.
const caminho = require.resolve("../src/services/prisma");

require.cache[caminho] = {
  id: caminho,
  filename: caminho,
  loaded: true,
  exports: db,
};

const controller = require(
  "../src/controllers/iniciativaController"
);

beforeEach(() => {
  gravacoes = [];

  db.$transaction = async (fn) => fn(db);

  db.usuario = {
    findUnique: async () => ({
      id_usuario: 7,
    }),
  };

  db.iniciativa = {
    findUnique: async () => ({
      id_iniciativa: 1,
      status_dossie: "Aberto",
      ano_base: 2026,
    }),

    count: async () => 0,

    findMany: async () => [],

    create: async ({ data }) => {
      gravacoes.push(data);

      return {
        id_iniciativa: 1,
        ...data,
      };
    },

    update: async ({ data }) => {
      gravacoes.push(data);

      return {
        id_iniciativa: 1,
        ...data,
      };
    },

    delete: async () => ({
      id_iniciativa: 1,
    }),
  };

  db.auditoria = {
    create: async ({ data }) => {
      gravacoes.push(data);
      return data;
    },
  };

  for (const modelo of [
    "dispendio",
    "timesheet",
    "marcoExperimento",
    "parecerTecnico",
    "alerta",
  ]) {
    db[modelo] = {
      count: async () => 0,
      findMany: async () => [],
    };
  }
});

function requisicao(extra = {}) {
  return {
    params: { id: "1" },
    query: {},
    body: {},
    usuarioId: 7,
    usuarioPerfil: "Analista P&D",
    ...extra,
  };
}

function resposta() {
  return {
    statusCode: 200,

    status(codigo) {
      this.statusCode = codigo;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },

    send() {
      return this;
    },
  };
}

function inesperado(error) {
  throw error;
}

function projetoValido() {
  return {
    codigo: "PND-001",
    nome: "Experimento",
    classificacao_pd: "Pesquisa aplicada",
    score_trl: 4,
    elegibilidade_pct: 90,
    risco_glosa: "Baixo",
    ano_base: 2026,
    usuario_responsavel_id: 7,
  };
}

test(
  "cadastro exige responsável e ano-base; valida limites e campos proibidos",
  async () => {
    const alteracoesInvalidas = [
      { usuario_responsavel_id: undefined },
      { ano_base: undefined },
      { score_trl: 10 },
      { elegibilidade_pct: 101 },
      { orcamento: -1 },
      { status_dossie: "Fechado" },
      { data_inicio: "2026-02-30" },
    ];

    for (const patch of alteracoesInvalidas) {
      const res = resposta();

      await controller.create(
        requisicao({
          body: {
            ...projetoValido(),
            ...patch,
          },
        }),
        res,
        inesperado
      );

      assert.equal(res.statusCode, 400);
    }

    assert.equal(gravacoes.length, 0);
  }
);

test(
  "cadastro usa responsável informado e registra autor na auditoria",
  async () => {
    const res = resposta();

    await controller.create(
      requisicao({
        body: projetoValido(),
      }),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 201);
    assert.equal(
      gravacoes[0].usuario_responsavel_id,
      7
    );
    assert.equal(gravacoes[1].usuario_id, 7);
    assert.equal(gravacoes[1].acao, "CRIAR");
  }
);

test(
  "responsável inexistente impede cadastro",
  async () => {
    db.usuario.findUnique = async () => null;

    const res = resposta();

    await controller.create(
      requisicao({
        body: projetoValido(),
      }),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 400);
    assert.equal(gravacoes.length, 0);
  }
);

test(
  "listagem aplica paginação, busca e filtros de ano e TRL",
  async () => {
    let consulta;

    db.iniciativa.count = async () => 12;

    db.iniciativa.findMany = async (args) => {
      consulta = args;
      return [];
    };

    const res = resposta();

    await controller.findAll(
      requisicao({
        query: {
          pagina: "2",
          limite: "5",
          busca: "IA",
          ano_base: "2026",
          trl_min: "4",
          trl_max: "6",
        },
      }),
      res,
      inesperado
    );

    assert.equal(consulta.skip, 5);
    assert.equal(consulta.take, 5);
    assert.equal(consulta.where.ano_base, 2026);

    assert.deepEqual(
      consulta.where.score_trl,
      { gte: 4, lte: 6 }
    );

    assert.equal(consulta.where.OR.length, 3);

    assert.equal(
      consulta.include.usuario_responsavel.select.senha,
      undefined
    );

    assert.equal(
      res.body.paginacao.total_paginas,
      3
    );
  }
);

test(
  "detalhe seleciona usuário sem senha e evidências sem bytes",
  async () => {
    let consulta;

    db.iniciativa.findUnique = async (args) => {
      consulta = args;

      return {
        id_iniciativa: 1,
      };
    };

    const res = resposta();

    await controller.findById(
      requisicao(),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 200);

    assert.equal(
      consulta.include.usuario_responsavel.select.senha,
      undefined
    );

    assert.equal(
      consulta.include.usuario_responsavel.select.nome,
      true
    );

    assert.equal(
      consulta.include.marcos.include.evidencias.select.conteudo,
      undefined
    );
  }
);

test(
  "ID inválido retorna 400 e projeto inexistente retorna 404",
  async () => {
    const a = resposta();

    await controller.findById(
      requisicao({
        params: { id: "abc" },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 400);

    db.iniciativa.findUnique = async () => null;

    const b = resposta();

    await controller.findById(
      requisicao(),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 404);
  }
);

test(
  "atualização recusa campos de fechamento e dossiê fechado",
  async () => {
    const a = resposta();

    await controller.update(
      requisicao({
        body: { fechado_por_id: 7 },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 400);

    db.iniciativa.findUnique = async () => ({
      id_iniciativa: 1,
      status_dossie: "Fechado",
    });

    const b = resposta();

    await controller.update(
      requisicao({
        body: { nome: "Novo nome" },
      }),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);
    assert.equal(gravacoes.length, 0);
  }
);

test(
  "atualização compara datas com o registro existente",
  async () => {
    db.iniciativa.findUnique = async () => ({
      id_iniciativa: 1,
      status_dossie: "Aberto",
      data_inicio: new Date("2026-06-01"),
    });

    const res = resposta();

    await controller.update(
      requisicao({
        body: {
          data_fim: "2026-05-01",
        },
      }),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 400);
  }
);

test(
  "ano-base não pode deixar despesa fora da apuração",
  async () => {
    db.dispendio.findMany = async () => [
      {
        data: new Date("2026-01-01"),
      },
    ];

    const res = resposta();

    await controller.update(
      requisicao({
        body: { ano_base: 2025 },
      }),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 409);
    assert.equal(gravacoes.length, 0);
  }
);

test(
  "atualização incrementa revisão e registra auditoria",
  async () => {
    const res = resposta();

    await controller.update(
      requisicao({
        body: {
          nome: "Nome revisado",
        },
      }),
      res,
      inesperado
    );

    assert.equal(res.statusCode, 200);

    assert.deepEqual(
      gravacoes[0].revisao,
      { increment: 1 }
    );

    assert.equal(
      gravacoes[1].acao,
      "ATUALIZAR"
    );
  }
);

test(
  "analista não exclui e gestor não exclui projeto com histórico",
  async () => {
    const a = resposta();

    await controller.delete(
      requisicao(),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 403);

    db.marcoExperimento.count = async () => 1;

    const b = resposta();

    await controller.delete(
      requisicao({
        usuarioPerfil: "Gestor P&D / Lei do Bem",
      }),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);
  }
);

test(
  "duplicidade vira 409 e erro interno segue para o middleware",
  async () => {
    db.iniciativa.create = async () => {
      throw Object.assign(
        new Error("Detalhe privado"),
        { code: "P2002" }
      );
    };

    const a = resposta();

    await controller.create(
      requisicao({
        body: projetoValido(),
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 409);

    assert.equal(
      JSON.stringify(a.body).includes("Detalhe privado"),
      false
    );

    const erroOriginal = new Error(
      "Falha de conexão"
    );

    db.iniciativa.findUnique = async () => {
      throw erroOriginal;
    };

    let recebido;

    await controller.findById(
      requisicao(),
      resposta(),
      (error) => {
        recebido = error;
      }
    );

    assert.equal(recebido, erroOriginal);
  }
);