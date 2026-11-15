const f = require("../utils/financeiro");
const s = require("../services/preparacaoFormpd");

const {
  permissoes,
} = require("../Middleware/controleAcesso");

function papel(req, anual) {
  const atual = permissoes(req).papel;

  const permitidos = anual
    ? ["gestor", "analista"]
    : ["gestor", "analista", "consultoria"];

  if (!permitidos.includes(atual)) {
    f.erro(
      403,
      "Seu perfil não possui acesso a esta preparação."
    );
  }

  return atual;
}

function semCache(res) {
  res.set("Cache-Control", "no-store");
}

async function log(
  db,
  req,
  entidade,
  registroId
) {
  await db.auditoria.create({
    data: {
      usuario_id: req.usuarioId,
      acao: "ATUALIZAR_PREPARACAO",
      entidade,
      registro_id: String(registroId),
    },
  });
}

module.exports = {
  consultarAno: f.executar(async (req, res) => {
    papel(req, true);

    const anoBase = s.ano(
      req.params.anoBase
    );

    const item =
      await f.prisma.dossieAnual.findUnique({
        where: {
          ano_base: anoBase,
        },
      });

    semCache(res);

    return res.json(
      s.seguro(item, false)
    );
  }),

  salvarAno: f.executar(async (req, res) => {
    const perfil = papel(req, true);

    const anoBase = s.ano(
      req.params.anoBase
    );

    const entrada = s.validar(
      req.body,
      true
    );

    if (
      perfil !== "gestor" &&
      Object.hasOwn(
        entrada.dados,
        "modelo_referencia_conferido"
      )
    ) {
      f.erro(
        403,
        "Somente o gestor confirma a revisão do modelo."
      );
    }

    const item = await f.transacao(
      async (db) => {
        const anterior =
          await db.dossieAnual.findUnique({
            where: {
              ano_base: anoBase,
            },
          });

        if (
          (anterior?.revisao || 0) !==
          entrada.revisao
        ) {
          f.erro(
            409,
            "Os dados foram alterados por outra pessoa. Recarregue antes de salvar."
          );
        }

        const dados = {
          dados: {
            ...anterior?.dados,
            ...entrada.dados,
          },

          atualizado_por_id:
            req.usuarioId,
        };

        const atualizado = anterior
          ? await db.dossieAnual.update({
              where: {
                ano_base: anoBase,
              },

              data: {
                ...dados,

                revisao: {
                  increment: 1,
                },
              },
            })
          : await db.dossieAnual.create({
              data: {
                ...dados,
                ano_base: anoBase,
              },
            });

        await log(
          db,
          req,
          "DossieAnual",
          anoBase
        );

        return atualizado;
      }
    );

    semCache(res);

    return res.json(
      s.seguro(item, false)
    );
  }),

  consultarProjeto: f.executar(
    async (req, res) => {
      const perfil = papel(req, false);

      const projeto = await f.projeto(
        f.prisma,
        req.params.iniciativaId
      );

      const item =
        await f.prisma.preparacaoFormpd.findUnique({
          where: {
            iniciativa_id:
              projeto.id_iniciativa,
          },
        });

      const mesmoAno =
        item?.ano_base ===
        projeto.ano_base;

      semCache(res);

      return res.json({
        ...s.seguro(
          mesmoAno ? item : null,
          perfil === "consultoria"
        ),

        ano_base: projeto.ano_base,

        fechado:
          projeto.status_dossie ===
          "Fechado",
      });
    }
  ),

  salvarProjeto: f.executar(
    async (req, res) => {
      const perfil = papel(req, false);

      const entrada = s.validar(
        req.body,
        false,
        perfil === "consultoria"
      );

      const item = await f.transacao(
        async (db) => {
          const projeto = await f.projeto(
            db,
            req.params.iniciativaId,
            true
          );

          if (!projeto.ano_base) {
            f.erro(
              409,
              "Defina o ano-base do projeto antes de complementar."
            );
          }

          const anterior =
            await db.preparacaoFormpd.findUnique({
              where: {
                iniciativa_id:
                  projeto.id_iniciativa,
              },
            });

          if (
            (anterior?.revisao || 0) !==
            entrada.revisao
          ) {
            f.erro(
              409,
              "Os dados foram alterados por outra pessoa. Recarregue antes de salvar."
            );
          }

          if (entrada.dados.rubricas) {
            const dispendios =
              await db.dispendio.findMany({
                where: {
                  iniciativa_id:
                    projeto.id_iniciativa,
                },

                select: {
                  id_dispendio: true,
                },
              });

            const pertenceAOutroProjeto =
              entrada.dados.rubricas.some(
                (rubrica) =>
                  !dispendios.some(
                    (dispendio) =>
                      dispendio.id_dispendio ===
                      rubrica.id_dispendio
                  )
              );

            if (
              pertenceAOutroProjeto
            ) {
              f.erro(
                400,
                "Rubrica não pertence a um dispêndio deste projeto."
              );
            }
          }

          if (
            entrada.dados.profissionais
          ) {
            const timesheets =
              await db.timesheet.findMany({
                where: {
                  iniciativa_id:
                    projeto.id_iniciativa,
                },

                select: {
                  colaborador_id: true,
                },
              });

            const profissionalInvalido =
              entrada.dados.profissionais.some(
                (profissional) =>
                  !timesheets.some(
                    (timesheet) =>
                      timesheet.colaborador_id ===
                      profissional.colaborador_id
                  )
              );

            if (
              profissionalInvalido
            ) {
              f.erro(
                400,
                "Profissional não pertence aos timesheets deste projeto."
              );
            }
          }

          const dados = {
            ano_base:
              projeto.ano_base,

            dados: {
              ...anterior?.dados,
              ...entrada.dados,
            },

            atualizado_por_id:
              req.usuarioId,
          };

          const atualizado = anterior
            ? await db.preparacaoFormpd.update({
                where: {
                  iniciativa_id:
                    projeto.id_iniciativa,
                },

                data: {
                  ...dados,

                  revisao: {
                    increment: 1,
                  },
                },
              })
            : await db.preparacaoFormpd.create({
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
            "ATUALIZAR_PREPARACAO",
            "PreparacaoFormpd",
            projeto.id_iniciativa
          );

          return atualizado;
        }
      );

      semCache(res);

      return res.json(
        s.seguro(
          item,
          perfil === "consultoria"
        )
      );
    }
  ),
};