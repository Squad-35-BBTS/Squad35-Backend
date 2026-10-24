const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 A limpar dados anteriores...');
  await prisma.timesheet.deleteMany();
  await prisma.dispendio.deleteMany();
  await prisma.marcoExperimento.deleteMany();
  await prisma.iniciativa.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('👤 A criar utilizador responsável...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Carlos Drummond',
      email: 'carlos.drummond@bbts.com.br',
      senha: hashedPassword,
      perfil: 'Gestor P&D / Lei do Bem'
    }
  });

  console.log('🚀 A criar iniciativas de P&D...');
  await prisma.iniciativa.create({
    data: {
      codigo: 'PND-084',
      nome: 'Plataforma Cognitiva BBTS ServiceDesk',
      descricao: 'Incapacidade dos modelos LLM abertos comerciais em processar taxonomia bancária com precisão superior a 90%.',
      classificacao_pd: 'Desenv. Experimental / Software / NLP',
      score_trl: 7,
      elegibilidade_pct: 85.50,
      risco_glosa: 'Baixo (12%)',
      barreira_incerteza: 'Quantização Ponderada e RAG Híbrido com Grafos de Conhecimento',
      cnae: '6201-5/01',
      data_inicio: new Date('2026-03-01'),
      data_fim: new Date('2026-11-30'),
      usuario_responsavel_id: usuario.id_usuario,
      marcos: {
        create: [
          {
            titulo: 'Marco 1: Arquitetura do Modelo',
            periodo: 'Março/2026 - Abril/2026',
            descricao: 'Definição da taxonomia de intents bancários e mapeamento de restrições arquiteturais.',
            status_validacao: 'Validado',
            hash_evidencia: 'SHA256-ABC123XYZ789'
          }
        ]
      },
      dispendios: {
        create: [
          {
            descricao: 'Aquisição de instâncias de GPU dedicadas para treino/fine-tuning',
            valor: 45000.00,
            data: new Date('2026-03-15'),
            categoria: 'Serviços de Terceiros / Infraestrutura',
            documento_comprobatorio: 'NF-e 004821'
          }
        ]
      },
      timesheets: {
        create: [
          {
            colaborador_id: 'COLAB-01',
            colaborador_nome: 'Lucas Silveira (Arquiteto de IA)',
            cargo_regime: 'CLT - Dedicação Exclusiva P&D',
            data: new Date('2026-03-31'),
            horas_mes: 168,
            elegivel_pct: 100.00,
            custo_apropriado: 38648.00,
            status: 'Aprovado pelo Gestor'
          }
        ]
      }
    }
  });

  console.log('✅ Seed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });