const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = {};

let estado;
let consulta;

// Não acessa o MySQL real.
const caminho = require.resolve("../src/services/prisma");

require.cache[caminho] = {
  id: caminho,
  filename: caminho,
  loaded: true,
  exports: db,
};

const controller = require(
  "../src/controllers/governancaController"
);

beforeEach(() => {
  const agora = new Date();

  estado = {
    projeto: {
      id_iniciativa: 1,
      ano_base: 2026,
      revisao: 3,
      status_dossie: "Aberto",
      barreira_incerteza:
        "Hipótese experimental documentada",

      marcos: [
        {
          id_marco: 2,
          status_validacao: "Validado",
          validado_por_id: 7,
          validado_em: agora,

          evidencias: [
            {
              id_evidencia: 5,
              status: "Validado",
              validado_por_id: 7,
              validado_em: agora,
            },
          ],
        },
      ],

      timesheets: [
        {
          id_timesheet: 1,
          status: "Aprovado pelo Gestor",
          aprovado_por_id: 7,
          aprovado_em: agora,
          justificativa: "Experimento",
          data: new Date("2026-10-01"),
        },
      ],

      dispendios: [
        {
          id_dispendio: 1,
          documento_comprobatorio: "NF-001",
          data: new Date("2026-10-01"),
        },
      ],

      alertas: [],

      pareceres: [
        {
          id_parecer: 1,
          iniciativa_id: 1,
          autor_id: 7,
          conclusao: "Favorável",
          revisao_projeto: 3,
        },
      ],
    },

    logs: [],
  };

  consulta = null;

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
    findUnique: async (args) => {
      consulta = args;

      return args.where.id_iniciativa === 1
        ? estado.projeto
        : null;
    },

    update: async ({ data }) => {
      for (const [k, v] of Object.entries(data)) {
        estado.projeto[k] =
          k === "revisao"
            ? estado.projeto.revisao + v.increment
            : v;
      }

      return { ...estado.projeto };
    },
  };

  db.usuario = {
    findUnique: async ({ where }) =>
      where.id_usuario === 7
        ? { id_usuario: 7 }
        : null,
  };

  db.auditoria = {
    create: async ({ data }) => {
      estado.logs.push(data);
      return data;
    },
  };

  db.parecerTecnico = {
    create: async ({ data }) => {
      const item = {
        id_parecer: estado.projeto.pareceres.length + 1,
        ...data,
      };

      estado.projeto.pareceres.push(item);

      return item;
    },

    findMany: async () =>
      [...estado.projeto.pareceres].sort(
        (a, b) => b.id_parecer - a.id_parecer
      ),
  };

  const filtrar = (where) =>
    estado.projeto.alertas.filter((a) =>
      Object.entries(where).every(
        ([k, v]) => a[k] === v
      )
    );

  db.alerta = {
    create: async ({ data }) => {
      const item = {
        id_alerta: estado.projeto.alertas.length + 1,
        ...data,
      };

      estado.projeto.alertas.push(item);

      return item;
    },

    findUnique: async ({ where }) =>
      estado.projeto.alertas.find(
        (a) => a.id_alerta === where.id_alerta
      ) || null,

    update: async ({ where, data }) => {
      const item = estado.projeto.alertas.find(
        (a) => a.id_alerta === where.id_alerta
      );

      Object.assign(item, data);

      return item;
    },

    count: async ({ where }) => filtrar(where).length,

    findMany: async ({ where, skip, take }) =>
      [...filtrar(where)]
        .sort((a, b) => b.id_alerta - a.id_alerta)
        .slice(skip, skip + take),
  };
});

function req(extra = {}) {
  return {
    params: {
      iniciativaId: "1",
      alertaId: "1",
    },
    query: {},
    body: {},
    usuarioId: 7,
    usuarioPerfil: "Gestor P&D / Lei do Bem",
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

function parecer() {
  return {
    conteudo: "Hipótese e resultados analisados",
    conclusao: "Favorável",
  };
}

function alerta() {
  return {
    titulo: "Revisar documento",
    descricao: "Assinatura pendente",
    severidade: "Crítica",
  };
}

test(
  "consulta informa pendências e usa projeção sem senha e bytes",
  async () => {
    const r = res();

    await controller.consultarDossie(
      req(),
      r,
      inesperado
    );

    assert.equal(r.body.pronto_para_fechar, true);
    assert.deepEqual(r.body.pendencias, []);

    assert.equal(
      consulta.include.usuario_responsavel.select.senha,
      undefined
    );

    assert.equal(
      consulta.include.marcos.include.evidencias.select.conteudo,
      undefined
    );
  }
);

test(
  "consulta de projeto inexistente retorna 404",
  async () => {
    const r = res();

    await controller.consultarDossie(
      req({
        params: {
          iniciativaId: "999",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 404);
  }
);

test(
  "analista não emite parecer, resolve alerta, fecha ou reabre",
  async () => {
    for (const metodo of [
      "criarParecer",
      "resolverAlerta",
      "fecharDossie",
      "reabrirDossie",
    ]) {
      const r = res();

      await controller[metodo](
        req({
          usuarioPerfil: "Analista P&D",
        }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 403);
    }
  }
);

test(
  "parecer usa revisão e autor do servidor, sem incrementar revisão",
  async () => {
    const r = res();

    await controller.criarParecer(
      req({ body: parecer() }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 201);
    assert.equal(r.body.revisao_projeto, 3);
    assert.equal(r.body.autor_id, 7);
    assert.equal(estado.projeto.revisao, 3);
    assert.equal(
      estado.logs[0].acao,
      "EMITIR_PARECER"
    );
  }
);

test(
  "parecer recusa revisão enviada pelo cliente e conclusão inválida",
  async () => {
    const exemplos = [
      {
        ...parecer(),
        revisao_projeto: 999,
      },
      {
        ...parecer(),
        conclusao: "Aprovado automaticamente",
      },
    ];

    for (const body of exemplos) {
      const r = res();

      await controller.criarParecer(
        req({ body }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }
  }
);

test(
  "fechamento registra gestor, data e auditoria",
  async () => {
    const r = res();

    await controller.fecharDossie(
      req(),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.status_dossie, "Fechado");
    assert.equal(r.body.fechado_por_id, 7);
    assert.ok(r.body.fechado_em instanceof Date);
    assert.equal(estado.projeto.revisao, 3);
    assert.equal(
      estado.logs[0].acao,
      "FECHAR_DOSSIE"
    );
  }
);

test(
  "fechamento exige ano, barreira, marcos, evidências, aprovações e documentos",
  async () => {
    const original = structuredClone(estado.projeto);

    const invalidar = [
      (p) => {
        p.ano_base = null;
      },
      (p) => {
        p.barreira_incerteza = "";
      },
      (p) => {
        p.marcos = [];
      },
      (p) => {
        p.marcos[0].validado_por_id = null;
      },
      (p) => {
        p.marcos[0].evidencias = [];
      },
      (p) => {
        p.marcos[0].evidencias[0].status = "Pendente";
      },
      (p) => {
        p.timesheets[0].status = "Pendente";
      },
      (p) => {
        p.timesheets[0].aprovado_em = null;
      },
      (p) => {
        p.timesheets[0].justificativa = "";
      },
      (p) => {
        p.dispendios[0].documento_comprobatorio = null;
      },
      (p) => {
        p.dispendios[0].data = new Date("2025-01-01");
      },
      (p) => {
        p.timesheets[0].data = new Date("2025-01-01");
      },
    ];

    for (const mudar of invalidar) {
      estado.projeto = structuredClone(original);
      mudar(estado.projeto);

      const r = res();

      await controller.fecharDossie(
        req(),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 409);
    }
  }
);

test(
  "parecer favorável antigo ou desfavorável mais recente impede fechar",
  async () => {
    estado.projeto.revisao = 4;

    const a = res();

    await controller.fecharDossie(
      req(),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 409);

    estado.projeto.revisao = 3;

    estado.projeto.pareceres.push({
      id_parecer: 2,
      conclusao: "Desfavorável",
      revisao_projeto: 3,
    });

    const b = res();

    await controller.fecharDossie(
      req(),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);
  }
);

test(
  "alerta aberto impede fechar e sua criação invalida parecer anterior",
  async () => {
    const a = res();

    await controller.criarAlerta(
      req({ body: alerta() }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 201);
    assert.equal(a.body.status, "Aberto");
    assert.equal(estado.projeto.revisao, 4);

    const b = res();

    await controller.fecharDossie(
      req(),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);
  }
);

test(
  "responsável inexistente e severidade inválida são recusados",
  async () => {
    const exemplos = [
      {
        ...alerta(),
        responsavel_id: 999,
      },
      {
        ...alerta(),
        severidade: "Urgentíssimo",
      },
    ];

    for (const body of exemplos) {
      const r = res();

      await controller.criarAlerta(
        req({ body }),
        r,
        inesperado
      );

      assert.equal(r.statusCode, 400);
    }
  }
);

test(
  "resolução registra gestor, justificativa e exige novo parecer",
  async () => {
    await controller.criarAlerta(
      req({ body: alerta() }),
      res(),
      inesperado
    );

    const r = res();

    await controller.resolverAlerta(
      req({
        body: {
          resolucao: "Documento revisado",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 200);
    assert.equal(r.body.resolvido_por_id, 7);
    assert.ok(r.body.resolvido_em instanceof Date);

    const a = res();

    await controller.fecharDossie(
      req(),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 409);

    await controller.criarParecer(
      req({ body: parecer() }),
      res(),
      inesperado
    );

    const b = res();

    await controller.fecharDossie(
      req(),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 200);
  }
);

test(
  "resolução exige texto e não pode repetir",
  async () => {
    await controller.criarAlerta(
      req({ body: alerta() }),
      res(),
      inesperado
    );

    const a = res();

    await controller.resolverAlerta(
      req({
        body: {
          resolucao: "",
        },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 400);

    await controller.resolverAlerta(
      req({
        body: {
          resolucao: "Corrigido",
        },
      }),
      res(),
      inesperado
    );

    const b = res();

    await controller.resolverAlerta(
      req({
        body: {
          resolucao: "Corrigido",
        },
      }),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 409);
  }
);

test(
  "listagem de alertas filtra e pagina",
  async () => {
    await controller.criarAlerta(
      req({ body: alerta() }),
      res(),
      inesperado
    );

    const r = res();

    await controller.listarAlertas(
      req({
        query: {
          iniciativa_id: "1",
          status: "Aberto",
          limite: "1",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.body.paginacao.total, 1);
    assert.equal(r.body.dados.length, 1);

    const a = res();

    await controller.listarAlertas(
      req({
        query: {
          limite: "101",
        },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 400);
  }
);

test(
  "dossiê fechado impede parecer e alerta; não fecha duas vezes",
  async () => {
    estado.projeto.status_dossie = "Fechado";

    const operacoes = [
      ["criarParecer", parecer()],
      ["criarAlerta", alerta()],
      ["fecharDossie", {}],
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
  "reabertura exige motivo e registra nova revisão, sem reutilizar parecer",
  async () => {
    await controller.fecharDossie(
      req(),
      res(),
      inesperado
    );

    const a = res();

    await controller.reabrirDossie(
      req({
        body: {
          motivo: "",
        },
      }),
      a,
      inesperado
    );

    assert.equal(a.statusCode, 400);

    const b = res();

    await controller.reabrirDossie(
      req({
        body: {
          motivo: "Novo experimento",
        },
      }),
      b,
      inesperado
    );

    assert.equal(b.statusCode, 200);
    assert.equal(b.body.revisao, 4);
    assert.equal(b.body.fechado_em, null);

    assert.equal(
      estado.projeto.pareceres.at(-1).conclusao,
      "Reabertura"
    );

    const c = res();

    await controller.fecharDossie(
      req(),
      c,
      inesperado
    );

    assert.equal(c.statusCode, 409);
  }
);

test(
  "não reabre dossiê que já está aberto",
  async () => {
    const r = res();

    await controller.reabrirDossie(
      req({
        body: {
          motivo: "Teste",
        },
      }),
      r,
      inesperado
    );

    assert.equal(r.statusCode, 409);
  }
);

test(
  "falha de auditoria reverte fechamento no dublê",
  async () => {
    db.auditoria.create = async () => {
      throw new Error("Falha de auditoria");
    };

    let recebido;

    await controller.fecharDossie(
      req(),
      res(),
      (error) => {
        recebido = error;
      }
    );

    assert.equal(
      recebido.message,
      "Falha de auditoria"
    );

    assert.equal(
      estado.projeto.status_dossie,
      "Aberto"
    );
  }
);