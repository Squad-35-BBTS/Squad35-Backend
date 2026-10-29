const f = require("../utils/financeiro");

function validar(body, parcial = false) {
  const permitidos = [
    "colaborador_id",
    "colaborador_nome",
    "cargo_regime",
    "data",
    "horas_mes",
    "elegivel_pct",
    "custo_apropriado",
    "justificativa",
  ];

  f.campos(body, permitidos);

  const dados = {};

  for (const campo of permitidos) {
    if (parcial && body[campo] === undefined) {
      continue;
    }

    if (campo === "data") {
      dados[campo] = f.data(body[campo]);
    } else if (campo === "horas_mes") {
      dados[campo] = f.decimal(
        body[campo],
        campo,
        0.01,
        744
      );
    } else if (campo === "elegivel_pct") {
      dados[campo] = f.decimal(
        body[campo],
        campo,
        0,
        100
      );
    } else if (campo === "custo_apropriado") {
      dados[campo] = f.decimal(
        body[campo],
        campo,
        0,
        9999999999.99
      );
    } else {
      dados[campo] = f.texto(
        body[campo],
        campo,
        campo === "justificativa" ? 10000 : 191
      );
    }
  }

  return dados;
}

async function conferirHoras(db, dados, ignorarId) {
  const d = new Date(dados.data);

  const inicio = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      1
    )
  );

  const fim = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      1
    )
  );

  const limite = (fim - inicio) / 3600000;

  const registros = await db.timesheet.findMany({
    where: {
      colaborador_id: dados.colaborador_id,
      data: {
        gte: inicio,
        lt: fim,
      },
    },
    select: {
      id_timesheet: true,
      horas_mes: true,
    },
  });

  const total = registros
    .filter((t) => t.id_timesheet !== ignorarId)
    .reduce(
      (soma, t) =>
        soma + Math.round(Number(t.horas_mes) * 100),
      Math.round(Number(dados.horas_mes) * 100)
    );

  if (total > limite * 100) {
    f.erro(
      409,
      "As horas do colaborador, somadas em todos os projetos, excedem a duração do mês."
    );
  }
}

const pendente = {
  status: "Pendente",
  aprovado_em: null,
  aprovado_por_id: null,
};

module.exports = {
  listarTimesheets: f.executar(async (req, res) => {
    const p = await f.projeto(
      f.prisma,
      req.params.iniciativaId
    );

    const resultado = await f.prisma.timesheet.findMany({
      where: {
        iniciativa_id: p.id_iniciativa,
      },
      orderBy: [
        { data: "asc" },
        { id_timesheet: "asc" },
      ],
    });

    return res.json(resultado);
  }),

  criarTimesheet: f.executar(async (req, res) => {
    const dados = validar(req.body);

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      f.conferirAno(p, dados.data);

      await conferirHoras(db, dados);

      const item = await db.timesheet.create({
        data: {
          ...dados,
          iniciativa_id: p.id_iniciativa,
          ...pendente,
        },
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "CRIAR",
        "Timesheet",
        item.id_timesheet
      );

      return item;
    });

    return res.status(201).json(resultado);
  }),

  atualizarTimesheet: f.executar(async (req, res) => {
    const dados = validar(req.body, true);

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const anterior = await f.registro(
        db,
        "timesheet",
        "id_timesheet",
        req.params.timesheetId,
        p.id_iniciativa
      );

      const completo = {
        ...anterior,
        ...dados,
      };

      f.conferirAno(p, completo.data);

      if (!completo.justificativa?.trim()) {
        f.erro(
          400,
          "Preencha a justificativa antes de atualizar o timesheet."
        );
      }

      await conferirHoras(
        db,
        completo,
        anterior.id_timesheet
      );

      const item = await db.timesheet.update({
        where: {
          id_timesheet: anterior.id_timesheet,
        },
        data: {
          ...dados,
          ...pendente,
        },
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "ATUALIZAR",
        "Timesheet",
        item.id_timesheet
      );

      return item;
    });

    return res.json(resultado);
  }),

  aprovarLote: f.executar(async (req, res) => {
    f.exigirGestor(req);

    f.campos(req.body, ["ids"]);

    if (
      !Array.isArray(req.body.ids) ||
      !req.body.ids.length ||
      req.body.ids.length > 100
    ) {
      f.erro(400, "Informe entre 1 e 100 IDs.");
    }

    const ids = req.body.ids.map(f.id);

    if (new Set(ids).size !== ids.length) {
      f.erro(400, "Existem IDs duplicados no lote.");
    }

    const aprovados = await f.transacao(async (db) => {
      const resultado = [];

      // Ordem fixa para reduzir conflitos entre lotes concorrentes.
      const ordenados = [...ids].sort((a, b) => a - b);

      for (const timesheetId of ordenados) {
        const t = await db.timesheet.findUnique({
          where: {
            id_timesheet: timesheetId,
          },
        });

        if (!t) {
          f.erro(
            404,
            `Timesheet ${timesheetId} não encontrado.`
          );
        }

        const p = await f.projeto(
          db,
          t.iniciativa_id,
          true
        );

        f.conferirAno(p, t.data);

        if (t.status !== "Pendente") {
          f.erro(
            409,
            "Somente timesheets pendentes podem ser aprovados."
          );
        }

        if (!t.justificativa?.trim()) {
          f.erro(
            409,
            "Há timesheet sem justificativa no lote."
          );
        }

        await conferirHoras(
          db,
          t,
          t.id_timesheet
        );

        const item = await db.timesheet.update({
          where: {
            id_timesheet: t.id_timesheet,
          },
          data: {
            status: "Aprovado pelo Gestor",
            aprovado_em: new Date(),
            aprovado_por_id: req.usuarioId,
          },
        });

        await f.auditar(
          db,
          req,
          p.id_iniciativa,
          "APROVAR",
          "Timesheet",
          t.id_timesheet
        );

        resultado.push(item);
      }

      return resultado;
    });

    return res.json({ aprovados });
  }),
};