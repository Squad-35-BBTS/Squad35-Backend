/*
  Warnings:

  - You are about to alter the column `custo_apropriado` on the `timesheet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,2)`.
  - You are about to alter the column `horas_mes` on the `timesheet` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(6,2)`.

*/
-- AlterTable
ALTER TABLE `iniciativa` ADD COLUMN `ano_base` INTEGER NULL,
    ADD COLUMN `diretoria` VARCHAR(191) NOT NULL DEFAULT 'Não informada',
    ADD COLUMN `fechado_em` DATETIME(3) NULL,
    ADD COLUMN `fechado_por_id` INTEGER NULL,
    ADD COLUMN `gerencia` VARCHAR(191) NOT NULL DEFAULT 'Não informada',
    ADD COLUMN `orcamento` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `revisao` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `risco_glosa_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `status_dossie` VARCHAR(191) NOT NULL DEFAULT 'Aberto',
    ADD COLUMN `tipo_inovacao` VARCHAR(191) NOT NULL DEFAULT 'Tecnológica',
    ADD COLUMN `trilha_tecnologica` VARCHAR(191) NOT NULL DEFAULT 'Não classificada',
    ADD COLUMN `trl_inicial` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `marco_experimento` ADD COLUMN `validado_em` DATETIME(3) NULL,
    ADD COLUMN `validado_por_id` INTEGER NULL,
    MODIFY `status_validacao` VARCHAR(191) NOT NULL DEFAULT 'Pendente';

-- AlterTable
ALTER TABLE `timesheet` ADD COLUMN `aprovado_em` DATETIME(3) NULL,
    ADD COLUMN `aprovado_por_id` INTEGER NULL,
    ADD COLUMN `justificativa` TEXT NULL,
    MODIFY `custo_apropriado` DECIMAL(12, 2) NOT NULL,
    MODIFY `horas_mes` DECIMAL(6, 2) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'Pendente';

-- CreateTable
CREATE TABLE `evidencia` (
    `id_evidencia` INTEGER NOT NULL AUTO_INCREMENT,
    `marco_id` INTEGER NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL DEFAULT 'application/octet-stream',
    `tamanho_bytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `conteudo` LONGBLOB NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pendente',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validado_em` DATETIME(3) NULL,
    `validado_por_id` INTEGER NULL,

    INDEX `evidencia_marco_id_idx`(`marco_id`),
    PRIMARY KEY (`id_evidencia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parecer_tecnico` (
    `id_parecer` INTEGER NOT NULL AUTO_INCREMENT,
    `iniciativa_id` INTEGER NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `revisao_projeto` INTEGER NOT NULL,
    `conteudo` TEXT NOT NULL,
    `conclusao` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parecer_tecnico_iniciativa_id_idx`(`iniciativa_id`),
    PRIMARY KEY (`id_parecer`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerta` (
    `id_alerta` INTEGER NOT NULL AUTO_INCREMENT,
    `iniciativa_id` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `severidade` VARCHAR(191) NOT NULL,
    `prazo` DATE NULL,
    `responsavel_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Aberto',
    `resolucao` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvido_em` DATETIME(3) NULL,
    `resolvido_por_id` INTEGER NULL,

    INDEX `alerta_iniciativa_id_status_idx`(`iniciativa_id`, `status`),
    PRIMARY KEY (`id_alerta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id_auditoria` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `registro_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_entidade_registro_id_idx`(`entidade`, `registro_id`),
    PRIMARY KEY (`id_auditoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `iniciativa_ano_base_diretoria_status_idx` ON `iniciativa`(`ano_base`, `diretoria`, `status`);

-- CreateIndex
CREATE INDEX `iniciativa_score_trl_risco_glosa_idx` ON `iniciativa`(`score_trl`, `risco_glosa`);

-- AddForeignKey
ALTER TABLE `evidencia` ADD CONSTRAINT `evidencia_marco_id_fkey` FOREIGN KEY (`marco_id`) REFERENCES `marco_experimento`(`id_marco`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parecer_tecnico` ADD CONSTRAINT `parecer_tecnico_iniciativa_id_fkey` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa`(`id_iniciativa`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerta` ADD CONSTRAINT `alerta_iniciativa_id_fkey` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa`(`id_iniciativa`) ON DELETE RESTRICT ON UPDATE CASCADE;
