-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "versao_token" INTEGER NOT NULL DEFAULT 0,
    "perfil" TEXT NOT NULL DEFAULT 'Analista P&D',

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "iniciativa" (
    "id_iniciativa" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "classificacao_pd" TEXT NOT NULL,
    "score_trl" INTEGER NOT NULL,
    "elegibilidade_pct" DECIMAL(5,2) NOT NULL,
    "risco_glosa" TEXT NOT NULL,
    "barreira_incerteza" TEXT,
    "cnae" TEXT,
    "data_inicio" DATE,
    "data_fim" DATE,
    "status" TEXT NOT NULL DEFAULT 'Em Avaliação',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "usuario_responsavel_id" INTEGER NOT NULL,
    "ano_base" INTEGER,
    "diretoria" TEXT NOT NULL DEFAULT 'Não informada',
    "gerencia" TEXT NOT NULL DEFAULT 'Não informada',
    "trilha_tecnologica" TEXT NOT NULL DEFAULT 'Não classificada',
    "tipo_inovacao" TEXT NOT NULL DEFAULT 'Tecnológica',
    "trl_inicial" INTEGER NOT NULL DEFAULT 1,
    "risco_glosa_pct" DECIMAL(5,2),
    "orcamento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "status_dossie" TEXT NOT NULL DEFAULT 'Aberto',
    "fechado_em" TIMESTAMP(3),
    "fechado_por_id" INTEGER,

    CONSTRAINT "iniciativa_pkey" PRIMARY KEY ("id_iniciativa")
);

-- CreateTable
CREATE TABLE "marco_experimento" (
    "id_marco" SERIAL NOT NULL,
    "iniciativa_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status_validacao" TEXT NOT NULL DEFAULT 'Pendente',
    "validado_em" TIMESTAMP(3),
    "validado_por_id" INTEGER,
    "hash_evidencia" TEXT,
    "tamanho_arquivo" TEXT,

    CONSTRAINT "marco_experimento_pkey" PRIMARY KEY ("id_marco")
);

-- CreateTable
CREATE TABLE "dispendio" (
    "id_dispendio" SERIAL NOT NULL,
    "iniciativa_id" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" DATE NOT NULL,
    "categoria" TEXT NOT NULL,
    "documento_comprobatorio" TEXT,

    CONSTRAINT "dispendio_pkey" PRIMARY KEY ("id_dispendio")
);

-- CreateTable
CREATE TABLE "timesheet" (
    "id_timesheet" SERIAL NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL,
    "cargo_regime" TEXT NOT NULL,
    "iniciativa_id" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "horas_mes" DECIMAL(6,2) NOT NULL,
    "elegivel_pct" DECIMAL(5,2) NOT NULL,
    "custo_apropriado" DECIMAL(12,2) NOT NULL,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "aprovado_em" TIMESTAMP(3),
    "aprovado_por_id" INTEGER,

    CONSTRAINT "timesheet_pkey" PRIMARY KEY ("id_timesheet")
);

-- CreateTable
CREATE TABLE "evidencia" (
    "id_evidencia" SERIAL NOT NULL,
    "marco_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "tamanho_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validado_em" TIMESTAMP(3),
    "validado_por_id" INTEGER,

    CONSTRAINT "evidencia_pkey" PRIMARY KEY ("id_evidencia")
);

-- CreateTable
CREATE TABLE "parecer_tecnico" (
    "id_parecer" SERIAL NOT NULL,
    "iniciativa_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "revisao_projeto" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "conclusao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parecer_tecnico_pkey" PRIMARY KEY ("id_parecer")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id_alerta" SERIAL NOT NULL,
    "iniciativa_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "severidade" TEXT NOT NULL,
    "prazo" DATE,
    "responsavel_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Aberto',
    "resolucao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvido_em" TIMESTAMP(3),
    "resolvido_por_id" INTEGER,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id_alerta")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id_auditoria" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateTable
CREATE TABLE "recuperacao_senha" (
    "token_hash" CHAR(64) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "versao_token" INTEGER NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "utilizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacao_senha_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "dossie_anual" (
    "ano_base" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_por_id" INTEGER NOT NULL,

    CONSTRAINT "dossie_anual_pkey" PRIMARY KEY ("ano_base")
);

-- CreateTable
CREATE TABLE "preparacao_formpd" (
    "iniciativa_id" INTEGER NOT NULL,
    "ano_base" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_por_id" INTEGER NOT NULL,

    CONSTRAINT "preparacao_formpd_pkey" PRIMARY KEY ("iniciativa_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativa_codigo_key" ON "iniciativa"("codigo");

-- CreateIndex
CREATE INDEX "iniciativa_ano_base_diretoria_status_idx" ON "iniciativa"("ano_base", "diretoria", "status");

-- CreateIndex
CREATE INDEX "iniciativa_score_trl_risco_glosa_idx" ON "iniciativa"("score_trl", "risco_glosa");

-- CreateIndex
CREATE INDEX "evidencia_marco_id_idx" ON "evidencia"("marco_id");

-- CreateIndex
CREATE INDEX "parecer_tecnico_iniciativa_id_idx" ON "parecer_tecnico"("iniciativa_id");

-- CreateIndex
CREATE INDEX "alerta_iniciativa_id_status_idx" ON "alerta"("iniciativa_id", "status");

-- CreateIndex
CREATE INDEX "auditoria_entidade_registro_id_idx" ON "auditoria"("entidade", "registro_id");

-- CreateIndex
CREATE INDEX "recuperacao_senha_usuario_id_idx" ON "recuperacao_senha"("usuario_id");

-- CreateIndex
CREATE INDEX "recuperacao_senha_expira_em_idx" ON "recuperacao_senha"("expira_em");

-- AddForeignKey
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_usuario_responsavel_id_fkey" FOREIGN KEY ("usuario_responsavel_id") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marco_experimento" ADD CONSTRAINT "marco_experimento_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispendio" ADD CONSTRAINT "dispendio_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_marco_id_fkey" FOREIGN KEY ("marco_id") REFERENCES "marco_experimento"("id_marco") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parecer_tecnico" ADD CONSTRAINT "parecer_tecnico_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuperacao_senha" ADD CONSTRAINT "recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparacao_formpd" ADD CONSTRAINT "preparacao_formpd_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id_iniciativa") ON DELETE RESTRICT ON UPDATE CASCADE;
