const prisma = require('../services/prisma');

module.exports = {
  async create(req, res) {
    try {
      const { nome, descricao, data_inicio, data_fim, area, categoria_pd, nivel_inovacao, usuario_responsavel_id } = req.body;

      const iniciativa = await prisma.iniciativa.create({
        data: {
          nome,
          descricao,
          data_inicio: new Date(data_inicio),
          data_fim: new Date(data_fim),
          area,
          categoria_pd,
          nivel_inovacao,
          status: 'Em Avaliação',
          usuario_responsavel_id: usuario_responsavel_id || 1
        }
      });

      return res.status(201).json(iniciativa);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao cadastrar iniciativa.', details: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const iniciativas = await prisma.iniciativa.findMany({
        include: { usuario_responsavel: { select: { nome: true, email: true } } }
      });
      return res.json(iniciativas);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar iniciativas.', details: error.message });
    }
  },

  async findById(req, res) {
    try {
      const { id } = req.params;
      const iniciativa = await prisma.iniciativa.findUnique({
        where: { id_iniciativa: Number(id) },
        include: { usuario_responsavel: true }
      });

      if (!iniciativa) return res.status(404).json({ error: 'Iniciativa não encontrada.' });
      return res.json(iniciativa);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar iniciativa.', details: error.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, status, categoria_pd, nivel_inovacao } = req.body;

      const iniciativa = await prisma.iniciativa.update({
        where: { id_iniciativa: Number(id) },
        data: { nome, descricao, status, categoria_pd, nivel_inovacao }
      });

      return res.json(iniciativa);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao atualizar iniciativa.', details: error.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.iniciativa.delete({ where: { id_iniciativa: Number(id) } });
      return res.status(204).send();
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao deletar iniciativa.', details: error.message });
    }
  }
};