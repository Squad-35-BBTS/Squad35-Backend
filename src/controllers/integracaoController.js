const prisma = require("../services/prisma");
const f = require("../utils/financeiro");

module.exports = {
  me(req, res) {
    return res.json({
      usuario: req.usuario,
    });
  },

  usuarios: f.executar(async (_req, res) => {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        perfil: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    return res.json(usuarios);
  }),

  auditoria: f.executar(async (req, res) => {
    f.exigirGestor(req);

    if (Object.keys(req.query).length) {
      f.campos(req.query, ["pagina", "limite"]);
    }

    const pagina =
      req.query.pagina === undefined
        ? 1
        : f.id(req.query.pagina);

    const limite =
      req.query.limite === undefined
        ? 20
        : f.id(req.query.limite);

    if (pagina > 100000 || limite > 100) {
      f.erro(400, "Página ou limite inválido.");
    }

    const resultado = await prisma.$transaction(async (db) => ({
      dados: await db.auditoria.findMany({
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: {
          id_auditoria: "desc",
        },
      }),

      paginacao: {
        pagina,
        limite,
        total: await db.auditoria.count(),
      },
    }));

    resultado.paginacao.total_paginas = Math.ceil(
      resultado.paginacao.total / limite
    );

    return res.json(resultado);
  }),
};