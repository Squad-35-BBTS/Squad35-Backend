const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sga_lb_secret_key_bbts_2026';

module.exports = function(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  // O formato do header é "Bearer [token]"
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Erro no formato do token.' });
  }

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    // Guarda os dados do utilizador na requisição para uso futuro
    req.usuarioId = decoded.id_usuario;
    req.usuarioPerfil = decoded.perfil;
    
    return next();
  });
};