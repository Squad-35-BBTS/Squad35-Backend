const f = require("../utils/financeiro");

function validar(body, parcial = false) {
  f.campos(body, [
    "descricao",
    "valor",
    "data",
    "categoria",
    "documento_comprobatorio",
  ]);

  const dados = {};

  for (const campo of [
    "descricao",
    "valor",
    "data",
    "categoria",
  ]) {
    if (parcial && body[campo] === undefined) {
      continue;
    }

    if (campo === "valor") {
      dados[campo] = f.decimal(
        body[campo],
        campo,
        0.01,
        9999999999.99
      );
    } else if (campo === "data") {
      dados[campo] = f.data(body[campo]);
    } else {
      dados[campo] = f.texto(
        body[campo],
        campo,
        campo === "descricao" ? 10000 : 191
      );
    }
  }

  if (body.documento_comprobatorio !== undefined) {
    dados.documento_comprobatorio =
      body.documento_comprobatorio === null
        ? null
        : f.texto(
            body.documento_comprobatorio,
            "documento_comprobatorio"
          );
  }

  return dados;
}

module.exports = {
  listarDispendios: f.executar(async (req, res) => {
    const p = await f.projeto(
      f.prisma,
      req.params.iniciativaId
    );

    const resultado = await f.prisma.dispendio.findMany({
      where: {
        iniciativa_id: p.id_iniciativa,
      },
      orderBy: [
        { data: "asc" },
        { id_dispendio: "asc" },
      ],
    });

    return res.json(resultado);
  }),

  criarDispendio: f.executar(async (req, res) => {
    const dados = validar(req.body);

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      f.conferirAno(p, dados.data);

      const item = await db.dispendio.create({
        data: {
          ...dados,
          iniciativa_id: p.id_iniciativa,
        },
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "CRIAR",
        "Dispendio",
        item.id_dispendio
      );

      return item;
    });

    return res.status(201).json(resultado);
  }),

  atualizarDispendio: f.executar(async (req, res) => {
    const dados = validar(req.body, true);

    const resultado = await f.transacao(async (db) => {
      const p = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const anterior = await f.registro(
        db,
        "dispendio",
        "id_dispendio",
        req.params.dispendioId,
        p.id_iniciativa
      );

      f.conferirAno(
        p,
        dados.data || anterior.data
      );

      const item = await db.dispendio.update({
        where: {
          id_dispendio: anterior.id_dispendio,
        },
        data: dados,
      });

      await f.auditar(
        db,
        req,
        p.id_iniciativa,
        "ATUALIZAR",
        "Dispendio",
        item.id_dispendio
      );

      return item;
    });

    return res.json(resultado);
  }),
};