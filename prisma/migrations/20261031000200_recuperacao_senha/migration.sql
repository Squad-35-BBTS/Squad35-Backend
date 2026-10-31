CREATE TABLE `recuperacao_senha` (
  `token_hash` CHAR(64) NOT NULL,
  `usuario_id` INTEGER NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `versao_token` INTEGER NOT NULL,
  `expira_em` DATETIME(3) NOT NULL,
  `utilizado_em` DATETIME(3) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `recuperacao_senha_usuario_id_idx` (`usuario_id`),
  INDEX `recuperacao_senha_expira_em_idx` (`expira_em`),
  PRIMARY KEY (`token_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recuperacao_senha`
ADD CONSTRAINT `recuperacao_senha_usuario_id_fkey`
FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`)
ON DELETE CASCADE ON UPDATE CASCADE;
