const f = require("../utils/financeiro");

const detalhe = {
  usuario_responsavel: {
    select: {
      id_usuario: true,
      nome: true,
      email: true,
      perfil: true,
    },
  },

  marcos: {
    include: {
      evidencias: {
        select: {
          id_evidencia: true,
          nome: true,
          sha256: true,
          tamanho_bytes: true,
          status: true,
          criado_em: true,
          validado_em: true,
          validado_por_id: true,
        },
      },
    },
  },

  timesheets: true,
  dispendios: true,
  alertas: true,

  pareceres: {
    orderBy: {
      id_parecer: "desc",
    },
  },
};

async function carregar(db, projetoId) {
  const p = await db.iniciativa.findUnique({
    where: {
      id_iniciativa: f.id(projetoId),
    },
    include: detalhe,
  });

  if (!p) {
    f.erro(404, "Iniciativa não encontrada.");
  }

  return p;
}

function pendencias(p) {
  const lista = [];

  if (!p.ano_base) {
    lista.push("Preencha o ano-base do projeto.");
  }

  if (!p.barreira_incerteza?.trim()) {
    lista.push(
      "Descreva a barreira de incerteza tecnológica."
    );
  }

  if (!p.marcos.length) {
    lista.push("Cadastre ao menos um marco experimental.");
  }

  for (const m of p.marcos) {
    if (
      m.status_validacao !== "Validado" ||
      !m.validado_por_id ||
      !m.validado_em
    ) {
      lista.push(
        `Marco ${m.id_marco}: validação pendente.`
      );
    }

    if (!m.evidencias.length) {
      lista.push(
        `Marco ${m.id_marco}: nenhuma evidência anexada.`
      );
    }

    for (const e of m.evidencias) {
      if (
        e.status !== "Validado" ||
        !e.validado_por_id ||
        !e.validado_em
      ) {
        lista.push(
          `Evidência ${e.id_evidencia}: validação pendente.`
        );
      }
    }
  }

  for (const t of p.timesheets) {
    if (
      t.status !== "Aprovado pelo Gestor" ||
      !t.aprovado_por_id ||
      !t.aprovado_em ||
      !t.justificativa?.trim()
    ) {
      lista.push(
        `Timesheet ${t.id_timesheet}: aprovação ou justificativa pendente.`
      );
    }

    if (
      new Date(t.data).getUTCFullYear() !== p.ano_base
    ) {
      lista.push(
        `Timesheet ${t.id_timesheet}: fora do ano-base.`
      );
    }
  }

  for (const d of p.dispendios) {
    if (!d.documento_comprobatorio?.trim()) {
      lista.push(
        `Dispêndio ${d.id_dispendio}: referência documental ausente.`
      );
    }

    if (
      new Date(d.data).getUTCFullYear() !== p.ano_base
    ) {
      lista.push(
        `Dispêndio ${d.id_dispendio}: fora do ano-base.`
      );
    }
  }

  if (
    p.alertas.some(
      (a) => a.status !== "Resolvido"
    )
  ) {
    lista.push("Resolva todos os alertas do projeto.");
  }

  const ultimo = p.pareceres
    .filter(
      (item) => item.conclusao !== "Reabertura"
    )
    .sort(
      (a, b) => b.id_parecer - a.id_parecer
    )[0];

  if (
    !ultimo ||
    ultimo.conclusao !== "Favorável" ||
    ultimo.revisao_projeto !== p.revisao
  ) {
    lista.push(
      "Emita um parecer favorável para a revisão atual, após concluir os ajustes."
    );
  }

  return lista;
}

function log(
  db,
  req,
  acao,
  entidade,
  registroId
) {
  return db.auditoria.create({
    data: {
      usuario_id: req.usuarioId,
      acao,
      entidade,
      registro_id: String(registroId),
    },
  });
}

module.exports = {
  consultarDossie: f.executar(async (req, res) => {
    const p = await carregar(
      f.prisma,
      req.params.iniciativaId
    );

    const lista = pendencias(p);

    return res.json({
      projeto: p,
      pendencias: lista,
      pronto_para_fechar:
        p.status_dossie !== "Fechado" &&
        lista.length === 0,
    });
  }),

  listarPareceres: f.executar(async (req, res) => {
    const p = await f.projeto(
      f.prisma,
      req.params.iniciativaId
    );

    const resultado =
      await f.prisma.parecerTecnico.findMany({
        where: {
          iniciativa_id: p.id_iniciativa,
        },
        orderBy: {
          id_parecer: "desc",
        },
      });

    return res.json(resultado);
  }),

  criarParecer: f.executar(async (req, res) => {
    f.exigirGestor(req);

    f.campos(req.body, [
      "conteudo",
      "conclusao",
    ]);

    const conteudo = f.texto(
      req.body.conteudo,
      "conteudo",
      10000
    );

    const conclusao = f.texto(
      req.body.conclusao,
      "conclusao"
    );

    if (
      ![
        "Favorável",
        "Desfavorável",
        "Ajustes necessários",
      ].includes(conclusao)
    ) {
      f.erro(400, "Conclusão de parecer inválida.");
    }

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const item = await db.parecerTecnico.create({
        data: {
          iniciativa_id: p.id_iniciativa,
          autor_id: req.usuarioId,
          revisao_projeto: p.revisao,
          conteudo,
          conclusao,
        },
      });

      // O parecer registra a revisão atual.
      // Emiti-lo não cria outra revisão.
      await log(
        db,
        req,
        "EMITIR_PARECER",
        "ParecerTecnico",
        item.id_parecer
      );

      return item;
    });

    return res.status(201).json(resultado);
  }),

  listarAlertas: f.executar(async (req, res) => {
    if (Object.keys(req.query).length) {
      f.campos(req.query, [
        "iniciativa_id",
        "status",
        "severidade",
        "pagina",
        "limite",
      ]);
    }

    const where = {};

    if (req.query.iniciativa_id !== undefined) {
      where.iniciativa_id = f.id(
        req.query.iniciativa_id
      );
    }

    if (req.query.status !== undefined) {
      if (
        !["Aberto", "Resolvido"].includes(
          req.query.status
        )
      ) {
        f.erro(400, "Status de alerta inválido.");
      }

      where.status = req.query.status;
    }

    if (req.query.severidade !== undefined) {
      if (
        !["Baixa", "Média", "Crítica"].includes(
          req.query.severidade
        )
      ) {
        f.erro(400, "Severidade inválida.");
      }

      where.severidade = req.query.severidade;
    }

    const pagina =
      req.query.pagina === undefined
        ? 1
        : f.id(req.query.pagina);

    const limite =
      req.query.limite === undefined
        ? 10
        : f.id(req.query.limite);

    if (pagina > 100000 || limite > 100) {
      f.erro(
        400,
        "Página ou limite fora do intervalo permitido."
      );
    }

    const resultado =
      await f.prisma.$transaction(async (db) => {
        const total = await db.alerta.count({
          where,
        });

        const dados = await db.alerta.findMany({
          where,
          skip: (pagina - 1) * limite,
          take: limite,
          orderBy: {
            id_alerta: "desc",
          },
        });

        return {
          dados,
          paginacao: {
            pagina,
            limite,
            total,
            total_paginas: Math.ceil(total / limite),
          },
        };
      });

    return res.json(resultado);
  }),

  criarAlerta: f.executar(async (req, res) => {
    f.campos(req.body, [
      "titulo",
      "descricao",
      "severidade",
      "prazo",
      "responsavel_id",
    ]);

    const dados = {
      titulo: f.texto(
        req.body.titulo,
        "titulo"
      ),

      descricao: f.texto(
        req.body.descricao,
        "descricao",
        10000
      ),

      severidade: f.texto(
        req.body.severidade,
        "severidade"
      ),

      prazo:
        req.body.prazo === undefined ||
        req.body.prazo === null
          ? null
          : f.data(req.body.prazo),

      responsavel_id:
        req.body.responsavel_id === undefined
          ? req.usuarioId
          : f.id(req.body.responsavel_id),
    };

    if (
      !["Baixa", "Média", "Crítica"].includes(
        dados.severidade
      )
    ) {
      f.erro(400, "Severidade inválida.");
    }

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const responsavel = await db.usuario.findUnique({
        where: {
          id_usuario: dados.responsavel_id,
        },
        select: {
          id_usuario: true,
        },
      });

      if (!responsavel) {
        f.erro(
          400,
          "Responsável pelo alerta não encontrado."
        );
      }

      const item = await db.alerta.create({
        data: {
          ...dados,
          iniciativa_id: p.id_iniciativa,
          status: "Aberto",
        },
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "CRIAR",
        "Alerta",
        item.id_alerta
      );

      return item;
    });

    return res.status(201).json(resultado);
  }),

  resolverAlerta: f.executar(async (req, res) => {
    f.exigirGestor(req);

    f.campos(req.body, ["resolucao"]);

    const resolucao = f.texto(
      req.body.resolucao,
      "resolucao",
      10000
    );

    const alertaId = f.id(req.params.alertaId);

    const resultado = await f.transacao(async (db) => {
      const a = await db.alerta.findUnique({
        where: {
          id_alerta: alertaId,
        },
      });

      if (!a) {
        f.erro(404, "Alerta não encontrado.");
      }

      const p = await f.projeto(
        db,
        a.iniciativa_id,
        true
      );

      if (a.status !== "Aberto") {
        f.erro(409, "Alerta já resolvido.");
      }

      const item = await db.alerta.update({
        where: {
          id_alerta: alertaId,
        },
        data: {
          status: "Resolvido",
          resolucao,
          resolvido_em: new Date(),
          resolvido_por_id: req.usuarioId,
        },
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "RESOLVER",
        "Alerta",
        alertaId
      );

      return item;
    });

    return res.json(resultado);
  }),

  fecharDossie: f.executar(async (req, res) => {
    f.exigirGestor(req);

    const resultado = await f.transacao(async (db) => {
      const p = await carregar(
        db,
        req.params.iniciativaId
      );

      if (p.status_dossie === "Fechado") {
        f.erro(409, "Dossiê já fechado.");
      }

      const lista = pendencias(p);

      if (lista.length) {
        f.erro(409, lista.join(" | "));
      }

      const atualizado = await db.iniciativa.update({
        where: {
          id_iniciativa: p.id_iniciativa,
        },
        data: {
          status_dossie: "Fechado",
          fechado_em: new Date(),
          fechado_por_id: req.usuarioId,
        },
      });

      await log(
        db,
        req,
        "FECHAR_DOSSIE",
        "Iniciativa",
        p.id_iniciativa
      );

      return atualizado;
    });

    return res.json(resultado);
  }),

  reabrirDossie: f.executar(async (req, res) => {
    f.exigirGestor(req);

    f.campos(req.body, ["motivo"]);

    const motivo = f.texto(
      req.body.motivo,
      "motivo",
      10000
    );

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId
      );

      if (p.status_dossie !== "Fechado") {
        f.erro(409, "Dossiê já está aberto.");
      }

      const atualizado = await db.iniciativa.update({
        where: {
          id_iniciativa: p.id_iniciativa,
        },
        data: {
          status_dossie: "Aberto",
          fechado_em: null,
          fechado_por_id: null,
          revisao: {
            increment: 1,
          },
        },
      });

      // Preserva a justificativa da reabertura no histórico.
      await db.parecerTecnico.create({
        data: {
          iniciativa_id: p.id_iniciativa,
          autor_id: req.usuarioId,
          revisao_projeto: atualizado.revisao,
          conclusao: "Reabertura",
          conteudo: motivo,
        },
      });

      await log(
        db,
        req,
        "REABRIR_DOSSIE",
        "Iniciativa",
        p.id_iniciativa
      );

      return atualizado;
    });

    return res.json(resultado);
  }),
};