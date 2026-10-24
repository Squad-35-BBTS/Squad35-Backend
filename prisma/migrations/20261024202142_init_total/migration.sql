/*
  Warnings:

  - You are about to drop the column `area` on the `iniciativa` table. All the data in the column will be lost.
  - You are about to drop the column `categoria_pd` on the `iniciativa` table. All the data in the column will be lost.
  - You are about to drop the column `nivel_inovacao` on the `iniciativa` table. All the data in the column will be lost.
  - You are about to drop the column `descricao` on the `timesheet` table. All the data in the column will be lost.
  - You are about to drop the column `horas` on the `timesheet` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[codigo]` on the table `iniciativa` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classificacao_pd` to the `iniciativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo` to the `iniciativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `elegibilidade_pct` to the `iniciativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `risco_glosa` to the `iniciativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score_trl` to the `iniciativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cargo_regime` to the `timesheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `colaborador_nome` to the `timesheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `custo_apropriado` to the `timesheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `elegivel_pct` to the `timesheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horas_mes` to the `timesheet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `iniciativa` DROP COLUMN `area`,
    DROP COLUMN `categoria_pd`,
    DROP COLUMN `nivel_inovacao`,
    ADD COLUMN `barreira_incerteza` TEXT NULL,
    ADD COLUMN `classificacao_pd` VARCHAR(191) NOT NULL,
    ADD COLUMN `cnae` VARCHAR(191) NULL,
    ADD COLUMN `codigo` VARCHAR(191) NOT NULL,
    ADD COLUMN `elegibilidade_pct` DECIMAL(5, 2) NOT NULL,
    ADD COLUMN `risco_glosa` VARCHAR(191) NOT NULL,
    ADD COLUMN `score_trl` INTEGER NOT NULL,
    MODIFY `data_inicio` DATE NULL,
    MODIFY `data_fim` DATE NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'Em Avaliação';

-- AlterTable
ALTER TABLE `timesheet` DROP COLUMN `descricao`,
    DROP COLUMN `horas`,
    ADD COLUMN `cargo_regime` VARCHAR(191) NOT NULL,
    ADD COLUMN `colaborador_nome` VARCHAR(191) NOT NULL,
    ADD COLUMN `custo_apropriado` DECIMAL(10, 2) NOT NULL,
    ADD COLUMN `elegivel_pct` DECIMAL(5, 2) NOT NULL,
    ADD COLUMN `horas_mes` INTEGER NOT NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'Aprovado pelo Gestor',
    MODIFY `colaborador_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `usuario` MODIFY `perfil` VARCHAR(191) NOT NULL DEFAULT 'Analista P&D';

-- CreateTable
CREATE TABLE `marco_experimento` (
    `id_marco` INTEGER NOT NULL AUTO_INCREMENT,
    `iniciativa_id` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `periodo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `status_validacao` VARCHAR(191) NOT NULL DEFAULT 'Validado',
    `hash_evidencia` VARCHAR(191) NULL,
    `tamanho_arquivo` VARCHAR(191) NULL,

    PRIMARY KEY (`id_marco`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `iniciativa_codigo_key` ON `iniciativa`(`codigo`);

-- AddForeignKey
ALTER TABLE `marco_experimento` ADD CONSTRAINT `marco_experimento_iniciativa_id_fkey` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa`(`id_iniciativa`) ON DELETE CASCADE ON UPDATE CASCADE;
