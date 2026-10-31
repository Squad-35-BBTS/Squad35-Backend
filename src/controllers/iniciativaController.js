const prisma = require("../services/prisma");
const axios = require("axios");

const usuarioPublico = {
  id_usuario: true,
  nome: true,
  email: true,
  perfil: true,
};

const evidenciaPublica = {
  id_evidencia: true,
  nome: true,
  sha256: true,
  tamanho_bytes: true,
  status: true,
  criado_em: true,
};

const detalhe = {
  usuario_responsavel: {
    select: usuarioPublico,
  },
  marcos: {
    include: {
      evidencias: {
        select: evidenciaPublica,
      },
    },
  },
  dispendios: true,
  timesheets: true,
  pareceres: true,
  alertas: true,
};

function erro(status, mensagem) {
  throw Object.assign(new Error(mensagem), { status });
}

function numero(valor, campo, minimo, maximo, inteiro = false) {
  if (
    !["string", "number"].includes(typeof valor) ||
    (typeof valor === "string" && !valor.trim())
  ) {
    erro(400, `${campo}: informe um número.`);
  }

  const n = Number(valor);

  if (
    !Number.isFinite(n) ||
    n < minimo ||
    n > maximo ||
    (inteiro && !Number.isInteger(n))
  ) {
    erro(400, `${campo}: valor inválido.`);
  }

  return n;
}

function id(valor) {
  return numero(valor, "ID", 1, 2147483647, true);
}

function texto(valor, campo, maximo = 191) {
  if (
    typeof valor !== "string" ||
    !valor.trim() ||
    valor.trim().length > maximo
  ) {
    erro(
      400,
      `${campo}: informe um texto com até ${maximo} caracteres.`
    );
  }

  return valor.trim();
}

function data(valor, campo) {
  if (valor === null) {
    return null;
  }

  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    erro(400, `${campo}: use AAAA-MM-DD.`);
  }

  const d = new Date(`${valor}T00:00:00.000Z`);

  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== valor
  ) {
    erro(400, `${campo}: data inválida.`);
  }

  return d;
}

function duasCasas(valor, campo, maximo) {
  const n = numero(valor, campo, 0, maximo);

  if (Math.abs(n * 100 - Math.round(n * 100)) > 0.0001) {
    erro(400, `${campo}: use no máximo duas casas decimais.`);
  }

  return n.toFixed(2);
}

function camposPermitidos(objeto, campos) {
  if (
    !objeto ||
    typeof objeto !== "object" ||
    Array.isArray(objeto)
  ) {
    erro(400, "Envie um objeto JSON válido.");
  }

  for (const campo of Object.keys(objeto)) {
    if (!campos.includes(campo)) {
      erro(400, `Campo não permitido: ${campo}.`);
    }
  }
}

function validarProjeto(body, parcial = false) {
  const permitidos = [
    "codigo",
    "nome",
    "descricao",
    "classificacao_pd",
    "score_trl",
    "trl_inicial",
    "elegibilidade_pct",
    "risco_glosa",
    "risco_glosa_pct",
    "barreira_incerteza",
    "cnae",
    "data_inicio",
    "data_fim",
    "usuario_responsavel_id",
    "ano_base",
    "diretoria",
    "gerencia",
    "trilha_tecnologica",
    "tipo_inovacao",
    "status",
    "orcamento",
  ];

  camposPermitidos(body, permitidos);

  if (!parcial) {
    const obrigatorios = [
      "codigo",
      "nome",
      "classificacao_pd",
      "score_trl",
      "elegibilidade_pct",
      "risco_glosa",
      "usuario_responsavel_id",
      "ano_base",
    ];

    for (const campo of obrigatorios) {
      if (body[campo] === undefined) {
        erro(400, `Campo obrigatório: ${campo}.`);
      }
    }
  }

  if (!Object.keys(body).length) {
    erro(400, "Informe os dados do projeto.");
  }

  const resultado = {};

  for (const [campo, valor] of Object.entries(body)) {
    if (["data_inicio", "data_fim"].includes(campo)) {
      resultado[campo] = data(valor, campo);
    } else if (["score_trl", "trl_inicial"].includes(campo)) {
      resultado[campo] = numero(valor, campo, 1, 9, true);
    } else if (campo === "ano_base") {
      resultado[campo] = numero(valor, campo, 2000, 2100, true);
    } else if (campo === "usuario_responsavel_id") {
      resultado[campo] = id(valor);
    } else if (
      ["elegibilidade_pct", "risco_glosa_pct"].includes(campo)
    ) {
      resultado[campo] =
        campo === "risco_glosa_pct" && valor === null
          ? null
          : duasCasas(valor, campo, 100);
    } else if (campo === "orcamento") {
      resultado[campo] = duasCasas(
        valor,
        campo,
        9999999999.99
      );
    } else if (
      ["descricao", "barreira_incerteza", "cnae"].includes(campo) &&
      valor === null
    ) {
      resultado[campo] = null;
    } else {
      const maximo = [
        "descricao",
        "barreira_incerteza",
      ].includes(campo)
        ? 10000
        : 191;

      resultado[campo] = texto(valor, campo, maximo);
    }
  }

  if (
    resultado.risco_glosa &&
    !["Baixo", "Médio", "Alto"].includes(resultado.risco_glosa)
  ) {
    erro(400, "risco_glosa: use Baixo, Médio ou Alto.");
  }

  if (
    resultado.status &&
    ![
      "Em Avaliação",
      "Em Apuração",
      "Concluído",
    ].includes(resultado.status)
  ) {
    erro(400, "Status de projeto inválido.");
  }

  return resultado;
}

function validarPeriodo(projeto) {
  if (
    projeto.data_inicio &&
    projeto.data_fim &&
    projeto.data_fim < projeto.data_inicio
  ) {
    erro(
      400,
      "data_fim deve ser posterior ou igual a data_inicio."
    );
  }
}

function filtros(query) {
  camposPermitidos(query, [
    "busca",
    "ano_base",
    "diretoria",
    "gerencia",
    "tipo_inovacao",
    "status",
    "status_dossie",
    "risco_glosa",
    "trl_min",
    "trl_max",
    "pagina",
    "limite",
  ]);

  const where = {};

  for (const campo of [
    "diretoria",
    "gerencia",
    "tipo_inovacao",
    "status",
    "status_dossie",
  ]) {
    if (query[campo] !== undefined) {
      where[campo] = texto(query[campo], campo);
    }
  }

  if (query.risco_glosa !== undefined) {
    const risco = texto(query.risco_glosa, "risco_glosa");

    if (!["Baixo", "Médio", "Alto"].includes(risco)) {
      erro(400, "Faixa de risco inválida.");
    }

    // Aceita também registros antigos como "Baixo (12%)".
    where.AND = [
      {
        OR: [
          { risco_glosa: risco },
          {
            risco_glosa: {
              startsWith: `${risco} (`,
            },
          },
        ],
      },
    ];
  }

  if (query.ano_base !== undefined) {
    where.ano_base = numero(
      query.ano_base,
      "ano_base",
      2000,
      2100,
      true
    );
  }

  if (query.busca !== undefined) {
    const busca = texto(query.busca, "busca", 100);

    where.OR = [
      "codigo",
      "nome",
      "descricao",
    ].map((campo) => ({
      [campo]: { contains: busca },
    }));
  }

  if (
    query.trl_min !== undefined ||
    query.trl_max !== undefined
  ) {
    const gte =
      query.trl_min === undefined
        ? 1
        : numero(query.trl_min, "trl_min", 1, 9, true);

    const lte =
      query.trl_max === undefined
        ? 9
        : numero(query.trl_max, "trl_max", 1, 9, true);

    if (gte > lte) {
      erro(400, "Intervalo de TRL inválido.");
    }

    where.score_trl = { gte, lte };
  }

  return {
    where,
    pagina:
      query.pagina === undefined
        ? 1
        : numero(query.pagina, "pagina", 1, 100000, true),
    limite:
      query.limite === undefined
        ? 10
        : numero(query.limite, "limite", 1, 100, true),
  };
}

function tratarErro(error, res, next) {
  if (axios.isAxiosError(error)) {
    const externo = error.response?.status;
    const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code);
    const status = externo === 404 ? 404 : externo === 429 ? 429 : timeout ? 504 : 502;
    const mensagem = externo === 404
      ? 'CNPJ ou repositório não encontrado no serviço externo.'
      : externo === 429 ? 'Limite de consultas externas atingido. Tente novamente mais tarde.'
      : timeout ? 'O serviço externo demorou para responder. Tente novamente.'
      : 'Não foi possível consultar o serviço externo. Tente novamente mais tarde.';
    return res.status(status).json({ error: mensagem });
  }
  const status =
    error.status ||
    {
      P2002: 409,
      P2003: 400,
      P2025: 404,
      P2034: 409,
    }[error.code];

  if (!status) {
    return next(error);
  }

  const mensagem =
    {
      P2002: "Código de projeto já cadastrado.",
      P2003: "Responsável ou relacionamento inválido.",
      P2025: "Registro não encontrado.",
      P2034:
        "Conflito concorrente. Recarregue e tente novamente.",
    }[error.code] || error.message;

  return res.status(status).json({
    error: mensagem,
  });
}

const executar = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (error) {
    return tratarErro(error, res, next);
  }
};

const transacao = (fn) =>
  prisma.$transaction(fn, {
    isolationLevel: "Serializable",
  });

const auditar = (db, req, acao, projetoId) =>
  db.auditoria.create({
    data: {
      usuario_id: req.usuarioId,
      acao,
      entidade: "Iniciativa",
      registro_id: String(projetoId),
    },
  });

async function buscarAberto(db, projetoId) {
  const projeto = await db.iniciativa.findUnique({
    where: {
      id_iniciativa: projetoId,
    },
  });

  if (!projeto) {
    erro(404, "Iniciativa não encontrada.");
  }

  if (projeto.status_dossie === "Fechado") {
    erro(
      409,
      "Reabra o dossiê antes de alterar o projeto."
    );
  }

  return projeto;
}

const somarDinheiro = (valores) =>
  valores.reduce(
    (total, valor) =>
      total + Math.round(Number(valor) * 100),
    0
  ) / 100;

const carregarProjetos = (req) =>
  prisma.iniciativa.findMany({
    where: filtros(req.query).where,
    include: detalhe,
    orderBy: {
      id_iniciativa: "asc",
    },
  });

module.exports = {
  create: executar(async (req, res) => {
    const dados = validarProjeto(req.body);

    validarPeriodo(dados);

    const projeto = await transacao(async (db) => {
      const responsavel = await db.usuario.findUnique({
        where: {
          id_usuario: dados.usuario_responsavel_id,
        },
        select: {
          id_usuario: true,
        },
      });

      if (!responsavel) {
        erro(400, "Responsável não encontrado.");
      }

      const novo = await db.iniciativa.create({
        data: dados,
      });

      await auditar(
        db,
        req,
        "CRIAR",
        novo.id_iniciativa
      );

      return novo;
    });

    return res.status(201).json(projeto);
  }),

  findAll: executar(async (req, res) => {
    const { where, pagina, limite } = filtros(req.query);

    const resultado = await prisma.$transaction(
      async (db) => {
        const total = await db.iniciativa.count({
          where,
        });

        const dados = await db.iniciativa.findMany({
          where,
          skip: (pagina - 1) * limite,
          take: limite,
          orderBy: {
            id_iniciativa: "asc",
          },
          include: {
            usuario_responsavel: {
              select: usuarioPublico,
            },
            _count: {
              select: {
                marcos: true,
                dispendios: true,
                timesheets: true,
              },
            },
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
      }
    );

    return res.json(resultado);
  }),

  findById: executar(async (req, res) => {
    const projeto = await prisma.iniciativa.findUnique({
      where: {
        id_iniciativa: id(req.params.id),
      },
      include: detalhe,
    });

    if (!projeto) {
      erro(404, "Iniciativa não encontrada.");
    }

    return res.json(projeto);
  }),

  update: executar(async (req, res) => {
    const projetoId = id(req.params.id);
    const dados = validarProjeto(req.body, true);

    const projeto = await transacao(async (db) => {
      const anterior = await buscarAberto(
        db,
        projetoId
      );

      validarPeriodo({
        ...anterior,
        ...dados,
      });

      if (dados.usuario_responsavel_id !== undefined) {
        const responsavel = await db.usuario.findUnique({
          where: {
            id_usuario: dados.usuario_responsavel_id,
          },
          select: {
            id_usuario: true,
          },
        });

        if (!responsavel) {
          erro(400, "Responsável não encontrado.");
        }
      }

      if (
        dados.ano_base !== undefined &&
        dados.ano_base !== anterior.ano_base
      ) {
        const despesas = await db.dispendio.findMany({
          where: {
            iniciativa_id: projetoId,
          },
          select: {
            data: true,
          },
        });

        const horas = await db.timesheet.findMany({
          where: {
            iniciativa_id: projetoId,
          },
          select: {
            data: true,
          },
        });

        const registrosForaDoAno = [
          ...despesas,
          ...horas,
        ].some(
          (registro) =>
            new Date(registro.data).getUTCFullYear() !==
            dados.ano_base
        );

        if (registrosForaDoAno) {
          erro(
            409,
            "Existem despesas ou horas fora do ano-base informado. Revise a apuração primeiro."
          );
        }
      }

      const atualizado = await db.iniciativa.update({
        where: {
          id_iniciativa: projetoId,
        },
        data: {
          ...dados,
          revisao: {
            increment: 1,
          },
        },
      });

      await auditar(
        db,
        req,
        "ATUALIZAR",
        projetoId
      );

      return atualizado;
    });

    return res.json(projeto);
  }),

  delete: executar(async (req, res) => {
    const perfisPermitidos = [
      "Administrador",
      "Gestor P&D / Lei do Bem",
      "Gestor Lei do Bem",
    ];

    if (!perfisPermitidos.includes(req.usuarioPerfil)) {
      erro(
        403,
        "Somente gestor ou administrador pode excluir projetos."
      );
    }

    const projetoId = id(req.params.id);

    await transacao(async (db) => {
      await buscarAberto(db, projetoId);

      for (const modelo of [
        "marcoExperimento",
        "dispendio",
        "timesheet",
        "parecerTecnico",
        "alerta",
      ]) {
        const quantidade = await db[modelo].count({
          where: {
            iniciativa_id: projetoId,
          },
        });

        if (quantidade) {
          erro(
            409,
            "Projeto com histórico não pode ser excluído."
          );
        }
      }

      await db.iniciativa.delete({
        where: {
          id_iniciativa: projetoId,
        },
      });

      await auditar(
        db,
        req,
        "EXCLUIR",
        projetoId
      );
    });

    return res.status(204).send();
  }),

  getDashboardElegibilidade: executar(
    async (req, res) => {
      const projetos = await carregarProjetos(req);

      return res.json({
        kpis: {
          total_projetos: projetos.length,

          projetos_aderentes: projetos.filter(
            (p) => Number(p.elegibilidade_pct) >= 85
          ).length,

          aderencia_parcial: projetos.filter(
            (p) =>
              Number(p.elegibilidade_pct) >= 60 &&
              Number(p.elegibilidade_pct) < 85
          ).length,

          alto_risco_glosa: projetos.filter(
            (p) => p.risco_glosa.startsWith("Alto")
          ).length,

          documentos_rastreados: projetos.reduce(
            (total, p) =>
              total +
              p.marcos.reduce(
                (soma, marco) =>
                  soma + marco.evidencias.length,
                0
              ),
            0
          ),
        },
        projetos,
      });
    }
  ),

  async getApuraçãoFinanceira(req, res, next) {
    return executar(async (req, res) => {
      const projetos = await carregarProjetos(req);

      const timesheets = projetos.flatMap(
        (p) => p.timesheets
      );

      const dispendios = projetos.flatMap(
        (p) => p.dispendios
      );

      const aprovados = timesheets.filter(
        (t) => t.status === "Aprovado pelo Gestor"
      );

      return res.json({
        resumo_horas: {
          total_horas_apuradas: timesheets.reduce(
            (total, t) => total + Number(t.horas_mes),
            0
          ),

          horas_aprovadas: aprovados.reduce(
            (total, t) => total + Number(t.horas_mes),
            0
          ),
        },

        resumo_financeiro: {
          dispendio_consolidado: somarDinheiro(
            dispendios.map((d) => d.valor)
          ),

          custo_pessoal_aprovado: somarDinheiro(
            aprovados.map((t) => t.custo_apropriado)
          ),

          incentivo_fiscal_estimado: null,
        },

        timesheets,
        dispendios,
      });
    })(req, res, next);
  },

  exportarMcti: executar(async (req, res) => {
    const projetos = await carregarProjetos(req);

    return res.json({
      tipo:
        "Prévia interna. Não é formulário oficial para submissão.",

      ano_base:
        req.query.ano_base === undefined
          ? null
          : Number(req.query.ano_base),

      gerado_em: new Date(),
      total_projetos_envolvidos: projetos.length,
      projetos,
    });
  }),

  consultarCnpj: executar(async (req, res) => {
    const cnpj = String(
      req.params.cnpj || ""
    ).replace(/\D/g, "");

    if (cnpj.length !== 14) {
      erro(400, "Informe um CNPJ com 14 dígitos.");
    }

    const { data } = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      {
        timeout: 8000,
      }
    );

    return res.json({
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      situacao_cadastral:
        data.descricao_situacao_cadastral,

      cnae_principal: {
        codigo: data.cnae_fiscal,
        descricao: data.cnae_fiscal_descricao,
      },

      municipio: data.municipio,
      uf: data.uf,

      elegivel_lei_do_bem: null,
      aviso:
        "Consulta cadastral; elegibilidade não avaliada.",
    });
  }),

  consultarRepositorioGithub: executar(
    async (req, res) => {
      camposPermitidos(req.query, [
        "owner",
        "repo",
      ]);

      const owner = texto(
        req.query.owner,
        "owner",
        100
      );

      const repo = texto(
        req.query.repo,
        "repo",
        100
      );

      if (
        !/^[A-Za-z0-9_-]+$/.test(owner) ||
        !/^[A-Za-z0-9_.-]+$/.test(repo) ||
        [".", ".."].includes(repo)
      ) {
        erro(400, "Repositório inválido.");
      }

      const { data } = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits`,
        {
          params: {
            per_page: 5,
          },
          timeout: 8000,
        }
      );

      return res.json({
        repositorio: `${owner}/${repo}`,

        ultimos_commits_evidencia: data.map(
          (commit) => ({
            autor: commit.commit.author?.name,
            mensagem: commit.commit.message,
            data: commit.commit.author?.date,
            hash: commit.sha,
          })
        ),

        aviso:
          "Consulta de commits; documentos não são anexados nem validados automaticamente.",
      });
    }
  ),
};