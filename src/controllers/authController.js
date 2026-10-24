const prisma = require('../services/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sga_lb_secret_key_bbts_2026';

module.exports = {
  // Registar um novo utilizador de forma dinâmica e segura
  async register(req, res) {
    try {
      const { nome, email, senha, perfil } = req.body;

      if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email, senha).' });
      }

      // Verificar se o email já existe
      const usuarioExiste = await prisma.usuario.findUnique({ where: { email } });
      if (usuarioExiste) {
        return res.status(400).json({ error: 'Este e-mail já está registado no sistema.' });
      }

      // Encriptar a senha com bcrypt
      const salt = await bcrypt.genSalt(10);
      const senhaHash = await bcrypt.hash(senha, salt);

      // Criar utilizador na base de dados (a senha armazenada é apenas o hash seguro)
      await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHash,
          perfil: perfil || 'Analista P&D'
        }
      });

      // Retorna sucesso SEM expor nenhuma senha ou hash na resposta
      return res.status(201).json({
        message: 'Utilizador registado com sucesso!',
        utilizador: {
          nome,
          email,
          perfil: perfil || 'Analista P&D'
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao registar utilizador.', details: error.message });
    }
  },

  // Fazer login de forma dinâmica
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
      }

      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) {
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }

      const token = jwt.sign(
        { id_usuario: usuario.id_usuario, email: usuario.email, perfil: usuario.perfil },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      // Resposta limpa sem dados sensíveis
      return res.json({
        message: 'Login efetuado com sucesso!',
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao efetuar login.', details: error.message });
    }
  }
};