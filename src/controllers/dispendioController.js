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
    if (
      parcial &&
      body[campo] === undefined
    ) {
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
      dados[campo] = f.data(
        body[campo]
      );
    } else {
      dados[campo] = f.texto(
        body[campo],
        campo,
        campo === "descricao"
          ? 10000
          : 191
      );
    }
  }

  if (
    body.documento_comprobatorio !==
    undefined
  ) {
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
  listarDispendios: f.executar(
    async (req, res) => {
      const projeto = await f.projeto(
        f.prisma,
        req.params.iniciativaId
      );

      const resultado =
        await f.prisma.dispendio.findMany({
          where: {
            iniciativa_id:
              projeto.id_iniciativa,
          },

          orderBy: [
            { data: "asc" },
            { id_dispendio: "asc" },
          ],
        });

      return res.json(resultado);
    }
  ),

  criarDispendio: f.executar(
    async (req, res) => {
      const dados = validar(req.body);

      const resultado =
        await f.transacao(async (db) => {
          const projeto = await f.projeto(
            db,
            req.params.iniciativaId,
            true
          );

          f.conferirAno(
            projeto,
            dados.data
          );

          const duplicado =
            await db.dispendio.findFirst({
              where: {
                ...dados,

                documento_comprobatorio:
                  dados.documento_comprobatorio ??
                  null,

                iniciativa_id:
                  projeto.id_iniciativa,
              },
            });

          if (duplicado) {
            f.erro(
              409,
              "Dispêndio idêntico já registrado. Confira os lançamentos antes de repetir."
            );
          }

          const item =
            await db.dispendio.create({
              data: {
                ...dados,

                iniciativa_id:
                  projeto.id_iniciativa,
              },
            });

          await f.auditar(
            db,
            req,
            projeto.id_iniciativa,
            "CRIAR",
            "Dispendio",
            item.id_dispendio
          );

          return item;
        });

      return res.status(201).json(
        resultado
      );
    }
  ),

  atualizarDispendio: f.executar(
    async (req, res) => {
      const dados = validar(
        req.body,
        true
      );

      const resultado =
        await f.transacao(async (db) => {
          const projeto = await f.projeto(
            db,
            req.params.iniciativaId,
            true
          );

          const anterior =
            await f.registro(
              db,
              "dispendio",
              "id_dispendio",
              req.params.dispendioId,
              projeto.id_iniciativa
            );

          f.conferirAno(
            projeto,
            dados.data || anterior.data
          );

          const item =
            await db.dispendio.update({
              where: {
                id_dispendio:
                  anterior.id_dispendio,
              },

              data: dados,
            });

          await f.auditar(
            db,
            req,
            projeto.id_iniciativa,
            "ATUALIZAR",
            "Dispendio",
            item.id_dispendio
          );

          return item;
        });

      return res.json(resultado);
    }
  ),

   excluirDispendio: f.executar(async (req, res) => {
    f.exigirGestor(req);

    await f.transacao(async (db) => {
      const projeto = await f.projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const item = await f.registro(
        db,
        "dispendio",
        "id_dispendio",
        req.params.dispendioId,
        projeto.id_iniciativa
      );

      const preparacao =
        await db.preparacaoFormpd.findUnique({
          where: {
            iniciativa_id:
              projeto.id_iniciativa,
          },
        });

      const rubricas =
        preparacao?.dados?.rubricas;

      if (
        Array.isArray(rubricas) &&
        rubricas.some(
          (rubrica) =>
            rubrica.id_dispendio ===
            item.id_dispendio
        )
      ) {
        await db.preparacaoFormpd.update({
          where: {
            iniciativa_id:
              projeto.id_iniciativa,
          },

          data: {
            dados: {
              ...preparacao.dados,

              rubricas: rubricas.filter(
                (rubrica) =>
                  rubrica.id_dispendio !==
                  item.id_dispendio
              ),
            },

            revisao: {
              increment: 1,
            },

            atualizado_por_id:
              req.usuarioId,
          },
        });
      }

      await db.dispendio.delete({
        where: {
          id_dispendio:
            item.id_dispendio,
        },
      });

      await f.auditar(
        db,
        req,
        projeto.id_iniciativa,
        "EXCLUIR",
        "Dispendio",
        item.id_dispendio
      );
    });

    return res.status(204).send();
  }),
};