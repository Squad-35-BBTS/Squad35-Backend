const prisma = require('../services/prisma');

// Listar marcos de uma iniciativa
async function listarMarcos(req, res) {
  try {
    const { iniciativaId } = req.params;
    const marcos = await prisma.marcoExperimento.findMany({
      where: { iniciativa_id: Number(iniciativaId) }
    });
    return res.json(marcos);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao listar marcos.", details: error.message });
  }
}

// Criar um novo marco para uma iniciativa
async function criarMarco(req, res) {
  try {
    const { iniciativaId } = req.params;
    const { titulo, periodo, descricao, status_validacao, hash_evidencia } = req.body;

    const novoMarco = await prisma.marcoExperimento.create({
      data: {
        iniciativa_id: Number(iniciativaId),
        titulo,
        periodo,
        descricao,
        status_validacao,
        hash_evidencia
      }
    });

    return res.status(201).json(novoMarco);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar marco.", details: error.message });
  }
}

module.exports = { listarMarcos, criarMarco };