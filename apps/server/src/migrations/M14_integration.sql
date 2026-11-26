-- M14 企业微信 / 钉钉集成迁移

CREATE TABLE IF NOT EXISTS `sys_integration_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `channel` VARCHAR(24) NOT NULL, `name` VARCHAR(100) NOT NULL,
  `webhook_url` VARCHAR(500) NOT NULL,
  `secret_encrypted` VARCHAR(500) NULL, `secret_mask` VARCHAR(100) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_integration_channel` (`tenant_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_integration_message` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `channel` VARCHAR(24) NOT NULL,
  `title` VARCHAR(150) NOT NULL, `content` TEXT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `response_text` VARCHAR(1000) NULL,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_sys_integration_message` (`tenant_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
