CREATE TABLE `dossie_anual` (
  `ano_base` INTEGER NOT NULL,
  `dados` JSON NOT NULL,
  `revisao` INTEGER NOT NULL DEFAULT 1,
  `atualizado_em` DATETIME(3) NOT NULL,
  `atualizado_por_id` INTEGER NOT NULL,

  PRIMARY KEY (`ano_base`)
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE TABLE `preparacao_formpd` (
  `iniciativa_id` INTEGER NOT NULL,
  `ano_base` INTEGER NOT NULL,
  `dados` JSON NOT NULL,
  `revisao` INTEGER NOT NULL DEFAULT 1,
  `atualizado_em` DATETIME(3) NOT NULL,
  `atualizado_por_id` INTEGER NOT NULL,

  PRIMARY KEY (`iniciativa_id`),

  CONSTRAINT `preparacao_formpd_iniciativa_id_fkey`
    FOREIGN KEY (`iniciativa_id`)
    REFERENCES `iniciativa` (`id_iniciativa`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;