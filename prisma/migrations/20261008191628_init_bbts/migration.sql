-- CreateTable
CREATE TABLE `usuario` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `perfil` VARCHAR(191) NOT NULL DEFAULT 'Gestor Lei do Bem',

    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iniciativa` (
    `id_iniciativa` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `data_inicio` DATE NOT NULL,
    `data_fim` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Cadastrada',
    `area` VARCHAR(191) NOT NULL,
    `categoria_pd` VARCHAR(191) NOT NULL,
    `nivel_inovacao` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,
    `usuario_responsavel_id` INTEGER NOT NULL,

    PRIMARY KEY (`id_iniciativa`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispendio` (
    `id_dispendio` INTEGER NOT NULL AUTO_INCREMENT,
    `iniciativa_id` INTEGER NOT NULL,
    `descricao` TEXT NOT NULL,
    `valor` DECIMAL(12, 2) NOT NULL,
    `data` DATE NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `documento_comprobatorio` VARCHAR(191) NULL,

    PRIMARY KEY (`id_dispendio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timesheet` (
    `id_timesheet` INTEGER NOT NULL AUTO_INCREMENT,
    `colaborador_id` INTEGER NOT NULL,
    `iniciativa_id` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `horas` DECIMAL(5, 2) NOT NULL,
    `descricao` TEXT NULL,

    PRIMARY KEY (`id_timesheet`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `iniciativa` ADD CONSTRAINT `iniciativa_usuario_responsavel_id_fkey` FOREIGN KEY (`usuario_responsavel_id`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispendio` ADD CONSTRAINT `dispendio_iniciativa_id_fkey` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa`(`id_iniciativa`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timesheet` ADD CONSTRAINT `timesheet_iniciativa_id_fkey` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa`(`id_iniciativa`) ON DELETE CASCADE ON UPDATE CASCADE;
