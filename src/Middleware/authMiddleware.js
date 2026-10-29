const jwt = require("jsonwebtoken");
const prisma = require("../services/prisma");

module.exports = async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || "";
  const resultado = /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!resultado) {
    return res.status(401).json({
      error: "Informe o token no formato Bearer TOKEN.",
    });
  }

  const segredo = process.env.JWT_SECRET;

  if (!segredo || segredo.length < 32) {
    return next(
      new Error("JWT_SECRET não foi configurado corretamente.")
    );
  }

  try {
    const payload = jwt.verify(resultado[1], segredo, {
      algorithms: ["HS256"],
    });

    if (
      !Number.isInteger(payload.id_usuario) ||
      payload.id_usuario <= 0
    ) {
      return res.status(401).json({
        error: "Token inválido.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id_usuario: payload.id_usuario,
      },
      select: {
        id_usuario: true,
        nome: true,
        email: true,
        perfil: true,
      },
    });

    if (!usuario) {
      return res.status(401).json({
        error: "Usuário não encontrado.",
      });
    }

    // Mantém compatibilidade com os controllers atuais.
    req.usuarioId = usuario.id_usuario;
    req.usuarioPerfil = usuario.perfil;

    // Disponibiliza somente os dados públicos do usuário.
    req.usuario = usuario;

    return next();
  } catch (error) {
    const errosDeToken = [
      "JsonWebTokenError",
      "TokenExpiredError",
      "NotBeforeError",
    ];

    if (errosDeToken.includes(error.name)) {
      return res.status(401).json({
        error: "Token inválido ou expirado.",
      });
    }

    return next(error);
  }
};