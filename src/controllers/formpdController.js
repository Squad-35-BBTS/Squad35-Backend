const prisma = require("../services/prisma");
const f = require("../utils/financeiro");

const {
  gerarDossie,
} = require("../services/formpdService");

const exportar = require(
  "../services/formpdExport"
);

const PERFIS = [
  "Administrador",
  "Gestor P&D / Lei do Bem",
  "Gestor Lei do Bem",
  "Analista P&D",
];

const detalhe = {
  preparacao_formpd: true,

  usuario_responsavel: {
    select: {
      id_usuario: true,
      nome: true,
    },
  },

  marcos: {
    orderBy: {
      id_marco: "asc",
    },

    include: {
      evidencias: {
        orderBy: {
          id_evidencia: "asc",
        },

        select: {
          id_evidencia: true,
          nome: true,
          mime_type: true,
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

  pareceres: {
    orderBy: {
      id_parecer: "asc",
    },
  },

  alertas: {
    orderBy: {
      id_alerta: "asc",
    },
  },
};

module.exports = {
  consultar: f.executar(
    async (req, res) => {
      if (
        !PERFIS.includes(
          req.usuarioPerfil
        )
      ) {
        f.erro(
          403,
          "Seu perfil não pode exportar o dossiê completo."
        );
      }

      const query = req.query || {};

      const filtrosPermitidos = [
        "ano_base",
        "formato",
        "exportar",
      ];

      for (
        const campo
        of Object.keys(query)
      ) {
        if (
          !filtrosPermitidos.includes(
            campo
          )
        ) {
          f.erro(
            400,
            `Filtro não permitido: ${campo}.`
          );
        }
      }

      if (
        typeof query.ano_base !== "string" ||
        !/^\d{4}$/.test(query.ano_base) ||
        Number(query.ano_base) < 2000 ||
        Number(query.ano_base) > 2100
      ) {
        f.erro(
          400,
          "Selecione um ano-base entre 2000 e 2100 para preparar o dossiê."
        );
      }

      if (
        query.exportar !== undefined &&
        query.exportar !== "1"
      ) {
        f.erro(
          400,
          "Filtro exportar inválido."
        );
      }

      const anoBase =
        Number(query.ano_base);

      const formato =
        query.formato ?? "json";

      if (
        ![
          "json",
          "csv",
          "html",
        ].includes(formato)
      ) {
        f.erro(
          400,
          "Formato inválido: use json, csv ou html."
        );
      }

      const periodo = {
        gte: new Date(
          Date.UTC(
            anoBase,
            0,
            1
          )
        ),

        lt: new Date(
          Date.UTC(
            anoBase + 1,
            0,
            1
          )
        ),
      };

      const {
        projetos,
        anual,
      } = await prisma.$transaction(
        async (db) => {
          const projetos =
            await db.iniciativa.findMany({
              where: {
                ano_base: anoBase,
              },

              orderBy: {
                id_iniciativa: "asc",
              },

              include: {
                ...detalhe,

                timesheets: {
                  where: {
                    data: periodo,
                  },

                  orderBy: {
                    id_timesheet: "asc",
                  },
                },

                dispendios: {
                  where: {
                    data: periodo,
                  },

                  orderBy: {
                    id_dispendio: "asc",
                  },
                },
              },
            });

          const anual =
            await db.dossieAnual.findUnique({
              where: {
                ano_base: anoBase,
              },
            });

          const exportacao =
            formato !== "json" ||
            query.exportar === "1";

          if (exportacao) {
            await db.auditoria.create({
              data: {
                usuario_id:
                  req.usuarioId ||
                  req.usuario.id_usuario,

                acao:
                  `EXPORTAR_FORMPD_${formato.toUpperCase()}`,

                entidade:
                  "DossieAnual",

                registro_id:
                  String(anoBase),
              },
            });
          }

          return {
            projetos,
            anual,
          };
        },

        {
          isolationLevel:
            "RepeatableRead",
        }
      );

      const dossie = gerarDossie({
        anoBase,
        projetos,

        preparacao:
          anual?.dados || {},

        usuario:
          req.usuario,

        empresa: {
          razao_social:
            process.env.FORMPD_RAZAO_SOCIAL?.trim(),

          cnpj:
            process.env.FORMPD_CNPJ?.trim(),
        },
      });

      res.set(
        "Cache-Control",
        "no-store"
      );

      res.set(
        "X-Content-Type-Options",
        "nosniff"
      );

      if (formato === "json") {
        return res.json(dossie);
      }

      res.set(
        "Content-Disposition",
        `attachment; filename="dossie-formpd-${anoBase}.${formato}"`
      );

      res.type(
        formato === "csv"
          ? "text/csv"
          : "text/html"
      );

      return res.send(
        exportar[formato](dossie)
      );
    }
  ),
};