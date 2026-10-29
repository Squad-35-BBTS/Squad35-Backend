const prisma = require("../services/prisma");
const crypto = require("node:crypto");

const metadados = {
  id_evidencia: true,
  marco_id: true,
  nome: true,
  mime_type: true,
  tamanho_bytes: true,
  sha256: true,
  status: true,
  criado_em: true,
  validado_em: true,
  validado_por_id: true,
};

function falhar(status, mensagem) {
  throw Object.assign(new Error(mensagem), { status });
}

function id(valor) {
  if (
    !/^[1-9]\d*$/.test(String(valor)) ||
    Number(valor) > 2147483647
  ) {
    falhar(400, "ID inválido.");
  }

  return Number(valor);
}

function texto(valor, campo, maximo = 191) {
  if (
    typeof valor !== "string" ||
    !valor.trim() ||
    valor.trim().length > maximo
  ) {
    falhar(
      400,
      `${campo}: texto obrigatório, com até ${maximo} caracteres.`
    );
  }

  return valor.trim();
}

function campos(body, permitidos) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    falhar(400, "Envie um objeto JSON válido.");
  }

  for (const campo of Object.keys(body)) {
    if (!permitidos.includes(campo)) {
      falhar(400, `Campo não permitido: ${campo}.`);
    }
  }
}

function dadosMarco(body, parcial = false) {
  campos(body, ["titulo", "periodo", "descricao"]);

  const dados = {};

  for (const campo of ["titulo", "periodo", "descricao"]) {
    if (!parcial || body[campo] !== undefined) {
      dados[campo] = texto(
        body[campo],
        campo,
        campo === "descricao" ? 10000 : 191
      );
    }
  }

  if (!Object.keys(dados).length) {
    falhar(400, "Informe os campos do marco.");
  }

  return dados;
}

function exigirGestor(req) {
  const permitidos = [
    "Administrador",
    "Gestor P&D / Lei do Bem",
    "Gestor Lei do Bem",
  ];

  if (!permitidos.includes(req.usuarioPerfil)) {
    falhar(403, "Operação exige gestor ou administrador.");
  }
}

async function projeto(db, projetoId, alterar = false) {
  const p = await db.iniciativa.findUnique({
    where: {
      id_iniciativa: id(projetoId),
    },
  });

  if (!p) {
    falhar(404, "Iniciativa não encontrada.");
  }

  if (alterar && p.status_dossie === "Fechado") {
    falhar(
      409,
      "Reabra o dossiê antes de alterar seus registros."
    );
  }

  return p;
}

async function marco(db, marcoId, projetoId) {
  const m = await db.marcoExperimento.findUnique({
    where: {
      id_marco: id(marcoId),
    },
  });

  if (!m || m.iniciativa_id !== projetoId) {
    falhar(404, "Marco não encontrado nesta iniciativa.");
  }

  return m;
}

async function registrar(
  db,
  req,
  projetoId,
  acao,
  entidade,
  registroId
) {
  await db.iniciativa.update({
    where: {
      id_iniciativa: projetoId,
    },
    data: {
      revisao: {
        increment: 1,
      },
    },
  });

  await db.auditoria.create({
    data: {
      usuario_id: req.usuarioId,
      acao,
      entidade,
      registro_id: String(registroId),
    },
  });
}

const transacao = (fn) =>
  prisma.$transaction(fn, {
    isolationLevel: "Serializable",
  });

const pendente = {
  status_validacao: "Pendente",
  validado_em: null,
  validado_por_id: null,
};

const executar = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (error) {
    const status =
      error.status ||
      {
        P2003: 400,
        P2025: 404,
        P2034: 409,
      }[error.code];

    if (!status) {
      return next(error);
    }

    const mensagem =
      {
        P2003: "Relacionamento inválido.",
        P2025: "Registro não encontrado.",
        P2034: "Conflito concorrente. Tente novamente.",
      }[error.code] || error.message;

    return res.status(status).json({
      error: mensagem,
    });
  }
};

module.exports = {
  listarMarcos: executar(async (req, res) => {
    const p = await projeto(
      prisma,
      req.params.iniciativaId
    );

    const resultado = await prisma.marcoExperimento.findMany({
      where: {
        iniciativa_id: p.id_iniciativa,
      },
      orderBy: {
        id_marco: "asc",
      },
      include: {
        evidencias: {
          select: metadados,
        },
      },
    });

    return res.json(resultado);
  }),

  criarMarco: executar(async (req, res) => {
    const dados = dadosMarco(req.body);

    const resultado = await transacao(async (db) => {
      const p = await projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const m = await db.marcoExperimento.create({
        data: {
          ...dados,
          iniciativa_id: p.id_iniciativa,
          ...pendente,
        },
      });

      await registrar(
        db,
        req,
        p.id_iniciativa,
        "CRIAR",
        "MarcoExperimento",
        m.id_marco
      );

      return m;
    });

    return res.status(201).json(resultado);
  }),

  atualizarMarco: executar(async (req, res) => {
    const dados = dadosMarco(req.body, true);

    const resultado = await transacao(async (db) => {
      const p = await projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const m = await marco(
        db,
        req.params.marcoId,
        p.id_iniciativa
      );

      const atualizado = await db.marcoExperimento.update({
        where: {
          id_marco: m.id_marco,
        },
        data: {
          ...dados,
          ...pendente,
        },
      });

      await registrar(
        db,
        req,
        p.id_iniciativa,
        "ATUALIZAR",
        "MarcoExperimento",
        m.id_marco
      );

      return atualizado;
    });

    return res.json(resultado);
  }),

  anexarEvidencia: executar(async (req, res) => {
    campos(req.body, ["nome", "conteudo_base64"]);

    const nome = texto(req.body.nome, "nome");

    if (/[\\/\x00-\x1f\x7f]/.test(nome)) {
      falhar(400, "Nome de arquivo inválido.");
    }

    const raw = req.body.conteudo_base64;

    if (
      typeof raw !== "string" ||
      !raw.length ||
      raw.length > 6990508 ||
      raw.length % 4 !== 0 ||
      /[^A-Za-z0-9+/=]/.test(raw)
    ) {
      falhar(
        400,
        "Base64 inválido ou arquivo acima do limite de 5 MiB."
      );
    }

    const bytes = Buffer.from(raw, "base64");

    if (
      !bytes.length ||
      bytes.length > 5 * 1024 * 1024 ||
      bytes.toString("base64") !== raw
    ) {
      falhar(400, "Arquivo inválido ou maior que 5 MiB.");
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(bytes)
      .digest("hex");

    const resultado = await transacao(async (db) => {
      const p = await projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const m = await marco(
        db,
        req.params.marcoId,
        p.id_iniciativa
      );

      const e = await db.evidencia.create({
        data: {
          marco_id: m.id_marco,
          nome,
          mime_type: "application/octet-stream",
          tamanho_bytes: bytes.length,
          sha256,
          conteudo: bytes,
          status: "Pendente",
        },
        select: metadados,
      });

      // Um novo documento exige validar o marco novamente.
      await db.marcoExperimento.update({
        where: {
          id_marco: m.id_marco,
        },
        data: pendente,
      });

      await registrar(
        db,
        req,
        p.id_iniciativa,
        "ANEXAR",
        "Evidencia",
        e.id_evidencia
      );

      return e;
    });

    return res.status(201).json(resultado);
  }),

  baixarEvidencia: executar(async (req, res) => {
    const e = await prisma.evidencia.findUnique({
      where: {
        id_evidencia: id(req.params.evidenciaId),
      },
    });

    if (!e) {
      falhar(404, "Evidência não encontrada.");
    }

    const nome = encodeURIComponent(e.nome).replace(
      /['()*]/g,
      (c) =>
        `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        `attachment; filename="evidencia-${e.id_evidencia}.bin"; ` +
        `filename*=UTF-8''${nome}`,
      "X-Content-Type-Options": "nosniff",
    });

    return res.send(Buffer.from(e.conteudo));
  }),

  validarEvidencia: executar(async (req, res) => {
    exigirGestor(req);

    const evidenciaId = id(req.params.evidenciaId);

    const resultado = await transacao(async (db) => {
      const e = await db.evidencia.findUnique({
        where: {
          id_evidencia: evidenciaId,
        },
      });

      if (!e) {
        falhar(404, "Evidência não encontrada.");
      }

      const m = await db.marcoExperimento.findUnique({
        where: {
          id_marco: e.marco_id,
        },
      });

      if (!m) {
        falhar(404, "Marco não encontrado.");
      }

      const p = await projeto(
        db,
        m.iniciativa_id,
        true
      );

      if (e.status === "Validado") {
        falhar(409, "Evidência já validada.");
      }

      const hash = crypto
        .createHash("sha256")
        .update(Buffer.from(e.conteudo))
        .digest("hex");

      if (
        hash !== e.sha256 ||
        e.tamanho_bytes !== e.conteudo.length
      ) {
        falhar(
          409,
          "A integridade do arquivo não confere."
        );
      }

      const atualizado = await db.evidencia.update({
        where: {
          id_evidencia: evidenciaId,
        },
        data: {
          status: "Validado",
          validado_em: new Date(),
          validado_por_id: req.usuarioId,
        },
        select: metadados,
      });

      await registrar(
        db,
        req,
        p.id_iniciativa,
        "VALIDAR",
        "Evidencia",
        evidenciaId
      );

      return atualizado;
    });

    return res.json(resultado);
  }),

  validarMarco: executar(async (req, res) => {
    exigirGestor(req);

    const resultado = await transacao(async (db) => {
      const p = await projeto(
        db,
        req.params.iniciativaId,
        true
      );

      const m = await marco(
        db,
        req.params.marcoId,
        p.id_iniciativa
      );

      if (m.status_validacao === "Validado") {
        falhar(409, "Marco já validado.");
      }

      const evidencias = await db.evidencia.findMany({
        where: {
          marco_id: m.id_marco,
        },
        select: metadados,
      });

      const existemPendencias =
        !evidencias.length ||
        evidencias.some(
          (e) =>
            e.status !== "Validado" ||
            !e.validado_por_id ||
            !e.validado_em
        );

      if (existemPendencias) {
        falhar(
          409,
          "Anexe e valide todas as evidências antes de validar o marco."
        );
      }

      const atualizado = await db.marcoExperimento.update({
        where: {
          id_marco: m.id_marco,
        },
        data: {
          status_validacao: "Validado",
          validado_em: new Date(),
          validado_por_id: req.usuarioId,
        },
      });

      await registrar(
        db,
        req,
        p.id_iniciativa,
        "VALIDAR",
        "MarcoExperimento",
        m.id_marco
      );

      return atualizado;
    });

    return res.json(resultado);
  }),
};