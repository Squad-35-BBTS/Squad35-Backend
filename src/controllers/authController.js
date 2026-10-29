const prisma = require("../services/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function validarCredenciais(body, cadastro = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Envie um objeto JSON válido.";
  }

  const camposPermitidos = cadastro
    ? ["nome", "email", "senha"]
    : ["email", "senha"];

  const campoInvalido = Object.keys(body).find(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (campoInvalido) {
    return `Campo não permitido: ${campoInvalido}.`;
  }

  if (
    typeof body.email !== "string" ||
    body.email.trim().length > 191 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return "Informe um e-mail válido.";
  }

  if (
    typeof body.senha !== "string" ||
    body.senha.length === 0 ||
    Buffer.byteLength(body.senha, "utf8") > 72
  ) {
    return "Informe uma senha válida com até 72 bytes.";
  }

  if (cadastro && body.senha.length < 10) {
    return "A senha deve ter pelo menos 10 caracteres.";
  }

  if (
    cadastro &&
    (
      typeof body.nome !== "string" ||
      !body.nome.trim() ||
      body.nome.trim().length > 191
    )
  ) {
    return "Informe um nome com até 191 caracteres.";
  }

  return null;
}

function obterSegredo() {
  const segredo = process.env.JWT_SECRET;

  if (!segredo || segredo.length < 32) {
    throw new Error("JWT_SECRET não foi configurado corretamente.");
  }

  return segredo;
}

module.exports = {
  async register(req, res, next) {
    try {
      if (process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
        return res.status(403).json({
          error: "O cadastro público está desabilitado.",
        });
      }

      const erroValidacao = validarCredenciais(req.body, true);

      if (erroValidacao) {
        return res.status(400).json({
          error: erroValidacao,
        });
      }

      const nome = req.body.nome.trim();
      const email = req.body.email.trim().toLowerCase();

      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
        select: { id_usuario: true },
      });

      if (usuarioExistente) {
        return res.status(409).json({
          error: "Este e-mail já está cadastrado.",
        });
      }

      const senhaHash = await bcrypt.hash(req.body.senha, 12);

      const usuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHash,

          // O cliente não pode escolher um perfil privilegiado.
          perfil: "Analista P&D",
        },
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          perfil: true,
        },
      });

      return res.status(201).json({
        message: "Usuário cadastrado com sucesso.",
        usuario,
      });
    } catch (error) {
      // Trata também cadastros concorrentes com o mesmo e-mail.
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Este e-mail já está cadastrado.",
        });
      }

      return next(error);
    }
  },

  async login(req, res, next) {
    try {
      const erroValidacao = validarCredenciais(req.body);

      if (erroValidacao) {
        return res.status(400).json({
          error: erroValidacao,
        });
      }

      const email = req.body.email.trim().toLowerCase();

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });

      const senhaValida = usuario
        ? await bcrypt.compare(req.body.senha, usuario.senha)
        : false;

      if (!senhaValida) {
        return res.status(401).json({
          error: "E-mail ou senha inválidos.",
        });
      }

      const token = jwt.sign(
        {
          id_usuario: usuario.id_usuario,
        },
        obterSegredo(),
        {
          algorithm: "HS256",
          expiresIn: "8h",
        }
      );

      return res.status(200).json({
        message: "Login efetuado com sucesso.",
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
};