const prisma = require('../services/prisma');
const bcrypt = require('bcryptjs');

module.exports = {
  async register(req, res) {
    try {
      const { nome, email, senha, perfil } = req.body;

      const userExists = await prisma.usuario.findUnique({ where: { email } });
      if (userExists) {
        return res.status(400).json({ error: 'Este e-mail já está registado na plataforma.' });
      }

      const hashedPassword = await bcrypt.hash(senha, 8);

      const novoUsuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: hashedPassword,
          perfil: perfil || 'Analista'
        },
        select: {
          id_usuario: true,
          nome: true,
          email: true,
          perfil: true
        }
      });

      return res.status(201).json({
        message: 'Utilizador registado com sucesso!',
        usuario: novoUsuario
      });
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao registar utilizador.', details: error.message });
    }
  },

  async login(req, res) {
    try {
      const { email, senha } = req.body;

      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
      if (!senhaCorreta) {
        return res.status(401).json({ error: 'Credenciais inválidas (senha incorreta).' });
      }

      return res.json({
        message: 'Login efetuado com sucesso!',
        usuario: {
          id_usuario: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro no processo de login.', details: error.message });
    }
  }
};