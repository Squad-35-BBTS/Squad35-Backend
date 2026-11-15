const PERFIS = {
  Administrador: "gestor",
  "Gestor P&D / Lei do Bem": "gestor",
  "Gestor Lei do Bem": "gestor",
  "Analista P&D": "analista",
  Auditor: "auditor",
  "Consultoria especializada": "consultoria",
};

const ENQUADRAMENTO = [
  "classificacao_pd",
  "tipo_inovacao",
  "trl_inicial",
  "score_trl",
  "barreira_incerteza",
  "elegibilidade_pct",
  "risco_glosa",
  "risco_glosa_pct",
  "cnae",
];

const CAMPOS_PROJETO = [
  "id_iniciativa",
  "codigo",
  "nome",
  "descricao",
  "ano_base",
  "status",
  "status_dossie",
  "revisao",
  ...ENQUADRAMENTO,
];

const CAMPOS_PESSOAS = [
  "id_timesheet",
  "iniciativa_id",
  "colaborador_id",
  "colaborador_nome",
  "cargo_regime",
  "data",
  "horas_mes",
  "elegivel_pct",
  "justificativa",
  "status",
  "aprovado_em",
  "aprovado_por_id",
];

const CAMPOS_MARCOS = [
  "id_marco",
  "iniciativa_id",
  "titulo",
  "periodo",
  "descricao",
  "status_validacao",
  "validado_em",
  "validado_por_id",
];

const CAMPOS_EVIDENCIAS = [
  "id_evidencia",
  "nome",
  "mime_type",
  "sha256",
  "tamanho_bytes",
  "status",
  "criado_em",
  "validado_em",
  "validado_por_id",
];

function selecionar(objeto, campos) {
  return Object.fromEntries(
    campos
      .filter((campo) =>
        Object.hasOwn(objeto, campo)
      )
      .map((campo) => [
        campo,
        objeto[campo],
      ])
  );
}

function permissoes(req) {
  const papel = Object.hasOwn(
    PERFIS,
    req.usuarioPerfil
  )
    ? PERFIS[req.usuarioPerfil]
    : null;

  const telas = {
    gestor: [
      "dashboard",
      "projetos",
      "evidencias",
      "financeiro",
      "relatorios",
      "auditoria",
      "perfil",
      "consultas",
    ],

    analista: [
      "dashboard",
      "projetos",
      "evidencias",
      "financeiro",
      "relatorios",
      "perfil",
      "consultas",
    ],

    auditor: [
      "dashboard",
      "projetos",
      "evidencias",
      "pessoas",
      "perfil",
    ],

    consultoria: [
      "dashboard",
      "projetos",
      "perfil",
    ],
  };

  return {
    papel,

    telas: telas[papel] || ["perfil"],

    pode_mapear: [
      "gestor",
      "analista",
    ].includes(papel),

    pode_aprovar: papel === "gestor",

    pode_editar_enquadramento: [
      "gestor",
      "analista",
      "consultoria",
    ].includes(papel),
  };
}

function marcoSeguro(marco) {
  return {
    ...selecionar(
      marco,
      CAMPOS_MARCOS
    ),

    evidencias: (
      marco.evidencias || []
    ).map((evidencia) =>
      selecionar(
        evidencia,
        CAMPOS_EVIDENCIAS
      )
    ),
  };
}

function projetoSeguro(projeto, papel) {
  const resultado = selecionar(
    projeto,
    CAMPOS_PROJETO
  );

  if (papel === "auditor") {
    resultado.marcos = (
      projeto.marcos || []
    ).map(marcoSeguro);

    resultado.timesheets = (
      projeto.timesheets || []
    ).map((item) =>
      selecionar(
        item,
        CAMPOS_PESSOAS
      )
    );

    if (
      projeto.usuario_responsavel
    ) {
      resultado.usuario_responsavel =
        selecionar(
          projeto.usuario_responsavel,
          [
            "id_usuario",
            "nome",
          ]
        );
    }
  }

  return resultado;
}

function respostaSegura(
  data,
  papel,
  path
) {
  if (
    ![
      "auditor",
      "consultoria",
    ].includes(papel) ||
    !data ||
    data.error
  ) {
    return data;
  }

  if (
    /^\/iniciativas\/\d+\/marcos$/.test(
      path
    )
  ) {
    return data.map(marcoSeguro);
  }

  if (path === "/usuarios") {
    return data.map((usuario) =>
      selecionar(
        usuario,
        [
          "id_usuario",
          "nome",
        ]
      )
    );
  }

  if (
    /^\/iniciativas\/\d+\/timesheets$/.test(
      path
    )
  ) {
    return data.map((item) =>
      selecionar(
        item,
        CAMPOS_PESSOAS
      )
    );
  }

  if (
    path ===
    "/elegibilidade/dashboard"
  ) {
    return {
      kpis: {
        total_projetos:
          data.projetos.length,
      },

      projetos:
        data.projetos.map(
          (projeto) =>
            projetoSeguro(
              projeto,
              papel
            )
        ),
    };
  }

  if (path === "/iniciativas") {
    return {
      dados: data.dados.map(
        (projeto) =>
          projetoSeguro(
            projeto,
            papel
          )
      ),

      paginacao:
        data.paginacao,
    };
  }

  if (
    /^\/iniciativas\/\d+$/.test(
      path
    )
  ) {
    return projetoSeguro(
      data,
      papel
    );
  }

  return data;
}

function permitido(
  papel,
  method,
  path
) {
  const preparacaoAnual =
    /^\/relatorios\/formpd\/\d{4}\/preparacao$/.test(
      path
    );

  if (preparacaoAnual) {
    return (
      [
        "gestor",
        "analista",
      ].includes(papel) &&
      [
        "GET",
        "PUT",
      ].includes(method)
    );
  }

  const preparacaoProjeto =
    /^\/iniciativas\/\d+\/formpd$/.test(
      path
    );

  if (preparacaoProjeto) {
    return (
      [
        "gestor",
        "analista",
        "consultoria",
      ].includes(papel) &&
      [
        "GET",
        "PUT",
      ].includes(method)
    );
  }

  if (papel === "gestor") {
    return true;
  }

  if (method === "GET") {
    const consultaProjetos =
      path ===
        "/elegibilidade/dashboard" ||
      /^\/iniciativas(?:\/\d+)?$/.test(
        path
      );

    if (consultaProjetos) {
      return Boolean(papel);
    }

    if (papel === "analista") {
      return (
        [
          "/usuarios",
          "/apuracao/financeira",
          "/relatorios/mcti",
          "/relatorios/formpd",
          "/alertas",
        ].includes(path) ||
        /^\/iniciativas\/\d+\/(marcos|timesheets|dispendios|pareceres|dossie)$/.test(
          path
        ) ||
        /^\/evidencias\/\d+\/arquivo$/.test(
          path
        )
      );
    }

    if (papel === "auditor") {
      return (
        path === "/usuarios" ||
        /^\/iniciativas\/\d+\/(marcos|timesheets)$/.test(
          path
        ) ||
        /^\/evidencias\/\d+\/arquivo$/.test(
          path
        )
      );
    }
  }

  if (papel === "consultoria") {
    return (
      method === "PUT" &&
      /^\/iniciativas\/\d+$/.test(
        path
      )
    );
  }

  if (papel === "analista") {
    if (method === "POST") {
      return (
        path === "/iniciativas" ||
        /^\/iniciativas\/\d+\/(marcos|timesheets|dispendios|alertas)$/.test(
          path
        ) ||
        /^\/iniciativas\/\d+\/marcos\/\d+\/evidencias$/.test(
          path
        )
      );
    }

    if (method === "PUT") {
      return (
        /^\/iniciativas\/\d+$/.test(
          path
        ) ||
        /^\/iniciativas\/\d+\/(marcos|timesheets|dispendios)\/\d+$/.test(
          path
        )
      );
    }
  }

  return false;
}

function controleAcesso(
  req,
  res,
  next
) {
  const { papel } =
    permissoes(req);

  const path =
    req.path.replace(
      /\/+$/,
      ""
    ) || "/";

  const method =
    req.method === "HEAD"
      ? "GET"
      : req.method;

  const propriaConta =
    (
      [
        "GET",
        "PUT",
      ].includes(method) &&
      path === "/auth/me"
    ) ||
    (
      method === "PUT" &&
      path === "/auth/me/senha"
    ) ||
    (
      method === "GET" &&
      path === "/auth/permissoes"
    );

  if (
    !propriaConta &&
    !permitido(
      papel,
      method,
      path
    )
  ) {
    return res.status(403).json({
      error:
        "Seu perfil não possui acesso a este recurso.",
    });
  }

  const edicaoConsultoria =
    papel === "consultoria" &&
    method === "PUT" &&
    /^\/iniciativas\/\d+$/.test(
      path
    );

  if (edicaoConsultoria) {
    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.keys(body).length
    ) {
      return res.status(400).json({
        error:
          "Informe os campos de enquadramento.",
      });
    }

    const campoProibido =
      Object.keys(body).some(
        (campo) =>
          !ENQUADRAMENTO.includes(
            campo
          )
      );

    if (campoProibido) {
      return res.status(403).json({
        error:
          "Consultoria pode alterar somente campos de enquadramento.",
      });
    }
  }

  if (
    [
      "auditor",
      "consultoria",
    ].includes(papel)
  ) {
    const enviarJson =
      res.json.bind(res);

    res.json = (data) =>
      enviarJson(
        respostaSegura(
          data,
          papel,
          path
        )
      );
  }

  return next();
}

module.exports = {
  controleAcesso,
  permissoes,
};