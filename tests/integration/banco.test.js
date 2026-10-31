require("dotenv").config();

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../../src/services/prisma");

after(async () => {
  await prisma.$disconnect();
});

test("consegue conectar ao MySQL", async () => {
  const resultado = await prisma.$queryRaw`SELECT 1 AS conectado`;

  assert.equal(Number(resultado[0].conectado), 1);
});

test("iniciativa possui os novos campos", async () => {
  const resultado = await prisma.iniciativa.findMany({
    take: 1,
    select: {
      id_iniciativa: true,
      ano_base: true,
      diretoria: true,
      gerencia: true,
      trilha_tecnologica: true,
      tipo_inovacao: true,
      trl_inicial: true,
      risco_glosa_pct: true,
      orcamento: true,
      revisao: true,
      status_dossie: true,
      fechado_em: true,
      fechado_por_id: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("timesheet possui os campos de aprovação", async () => {
  const resultado = await prisma.timesheet.findMany({
    take: 1,
    select: {
      id_timesheet: true,
      horas_mes: true,
      justificativa: true,
      aprovado_em: true,
      aprovado_por_id: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("marco possui os campos de validação", async () => {
  const resultado = await prisma.marcoExperimento.findMany({
    take: 1,
    select: {
      id_marco: true,
      status_validacao: true,
      validado_em: true,
      validado_por_id: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("tabela de evidências está disponível", async () => {
  const resultado = await prisma.evidencia.findMany({
    take: 1,
    select: {
      id_evidencia: true,
      marco_id: true,
      sha256: true,
      tamanho_bytes: true,
      status: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("tabela de pareceres está disponível", async () => {
  const resultado = await prisma.parecerTecnico.findMany({
    take: 1,
    select: {
      id_parecer: true,
      iniciativa_id: true,
      autor_id: true,
      revisao_projeto: true,
      conclusao: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("tabela de alertas está disponível", async () => {
  const resultado = await prisma.alerta.findMany({
    take: 1,
    select: {
      id_alerta: true,
      iniciativa_id: true,
      severidade: true,
      status: true,
      resolvido_por_id: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});

test("tabela de auditoria está disponível", async () => {
  const resultado = await prisma.auditoria.findMany({
    take: 1,
    select: {
      id_auditoria: true,
      usuario_id: true,
      acao: true,
      entidade: true,
      registro_id: true,
    },
  });

  assert.ok(Array.isArray(resultado));
});
test('usuário possui versão de token para invalidar sessões', async () => {
  const usuarios = await prisma.usuario.findMany({
    take: 1,
    select: { id_usuario: true, versao_token: true },
  });
  for (const usuario of usuarios) {
    assert.ok(Number.isInteger(usuario.versao_token));
    assert.ok(usuario.versao_token >= 0);
  }
});
