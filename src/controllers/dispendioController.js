const prisma = require('../services/prisma');

// Listar dispêndios de uma iniciativa
async function listarDispendios(req, res) {
  try {
    const { iniciativaId } = req.params;
    const dispendios = await prisma.dispendio.findMany({
      where: { iniciativa_id: Number(iniciativaId) }
    });
    return res.json(dispendios);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao listar dispêndios.", details: error.message });
  }
}

// Criar um novo dispêndio para uma iniciativa
async function criarDispendio(req, res) {
  try {
    const { iniciativaId } = req.params;
    const { descricao, valor, data, categoria, documento_comprobatorio } = req.body;

    const novoDispendio = await prisma.dispendio.create({
      data: {
        iniciativa_id: Number(iniciativaId),
        descricao,
        valor: Number(valor),
        data: new Date(data),
        categoria,
        documento_comprobatorio
      }
    });

    return res.status(201).json(novoDispendio);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar dispêndio.", details: error.message });
  }
}

module.exports = { listarDispendios, criarDispendio };