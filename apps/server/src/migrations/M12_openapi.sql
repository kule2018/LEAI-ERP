-- M12 开放平台：API Key、Webhook 与投递记录

CREATE TABLE IF NOT EXISTS `sys_api_key` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `key_id` VARCHAR(60) NOT NULL, `secret_hash` VARCHAR(200) NOT NULL,
  `name` VARCHAR(100) NOT NULL, `scopes` JSON NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `last_used_at` DATETIME(3) NULL, `expires_at` DATETIME(3) NULL,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_api_key_id` (`tenant_id`, `key_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_webhook` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(100) NOT NULL, `url` VARCHAR(500) NOT NULL,
  `event_types` JSON NOT NULL, `secret_encrypted` VARCHAR(500) NULL, `secret_mask` VARCHAR(100) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', `retry_limit` INT NOT NULL DEFAULT 3,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), KEY `idx_sys_webhook_tenant` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_webhook_delivery` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `webhook_id` BIGINT NOT NULL,
  `event_type` VARCHAR(80) NOT NULL, `payload` JSON NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `attempt_count` INT NOT NULL DEFAULT 0,
  `response_text` VARCHAR(1000) NULL, `next_retry_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `delivered_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), KEY `idx_sys_webhook_delivery` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
