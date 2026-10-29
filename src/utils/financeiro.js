const prisma = require("../services/prisma");

function erro(status, mensagem) {
  throw Object.assign(new Error(mensagem), { status });
}

function id(valor) {
  if (
    !/^[1-9]\d*$/.test(String(valor)) ||
    Number(valor) > 2147483647
  ) {
    erro(400, "ID inválido.");
  }

  return Number(valor);
}

function texto(valor, campo, maximo = 191) {
  if (
    typeof valor !== "string" ||
    !valor.trim() ||
    valor.trim().length > maximo
  ) {
    erro(
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
    erro(400, "Envie um objeto JSON válido.");
  }

  for (const campo of Object.keys(body)) {
    if (!permitidos.includes(campo)) {
      erro(400, `Campo não permitido: ${campo}.`);
    }
  }

  if (!Object.keys(body).length) {
    erro(400, "Informe os dados da operação.");
  }
}

function decimal(valor, campo, minimo, maximo) {
  if (
    !["number", "string"].includes(typeof valor) ||
    (typeof valor === "string" && !valor.trim())
  ) {
    erro(400, `${campo}: informe um número.`);
  }

  const n = Number(valor);

  if (
    !Number.isFinite(n) ||
    n < minimo ||
    n > maximo ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.0001
  ) {
    erro(
      400,
      `${campo}: valor fora do intervalo ou com mais de duas casas decimais.`
    );
  }

  return n.toFixed(2);
}

function data(valor) {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    erro(400, "data: use AAAA-MM-DD.");
  }

  const d = new Date(`${valor}T00:00:00.000Z`);

  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== valor
  ) {
    erro(400, "Data inválida.");
  }

  return d;
}

async function projeto(db, projetoId, alterar = false) {
  const p = await db.iniciativa.findUnique({
    where: {
      id_iniciativa: id(projetoId),
    },
  });

  if (!p) {
    erro(404, "Iniciativa não encontrada.");
  }

  if (alterar && p.status_dossie === "Fechado") {
    erro(409, "Reabra o dossiê antes de alterar registros.");
  }

  return p;
}

function conferirAno(p, d) {
  if (p.ano_base === null || p.ano_base === undefined) {
    erro(
      409,
      "Preencha o ano-base do projeto antes de registrar valores ou horas."
    );
  }

  if (new Date(d).getUTCFullYear() !== p.ano_base) {
    erro(400, "A data deve pertencer ao ano-base do projeto.");
  }
}

async function registro(
  db,
  modelo,
  chave,
  registroId,
  projetoId
) {
  const item = await db[modelo].findUnique({
    where: {
      [chave]: id(registroId),
    },
  });

  if (!item || item.iniciativa_id !== projetoId) {
    erro(404, "Registro não encontrado nesta iniciativa.");
  }

  return item;
}

async function auditar(
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

function exigirGestor(req) {
  const permitidos = [
    "Administrador",
    "Gestor P&D / Lei do Bem",
    "Gestor Lei do Bem",
  ];

  if (!permitidos.includes(req.usuarioPerfil)) {
    erro(403, "Operação exige gestor ou administrador.");
  }
}

const transacao = (fn) =>
  prisma.$transaction(fn, {
    isolationLevel: "Serializable",
  });

const executar = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (error) {
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
        P2002: "Registro duplicado.",
        P2003: "Relacionamento inválido.",
        P2025: "Registro não encontrado.",
        P2034:
          "Conflito concorrente. Recarregue e tente novamente.",
      }[error.code] || error.message;

    return res.status(status).json({
      error: mensagem,
    });
  }
};

module.exports = {
  prisma,
  erro,
  id,
  texto,
  campos,
  decimal,
  data,
  projeto,
  conferirAno,
  registro,
  auditar,
  exigirGestor,
  transacao,
  executar,
};