-- M15 功能开关迁移

CREATE TABLE IF NOT EXISTS `sys_feature_flag` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(80) NOT NULL, `name` VARCHAR(120) NOT NULL, `module` VARCHAR(60) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ON',
  `gray_users` JSON NULL, `gray_roles` JSON NULL, `gray_percent` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_feature_flag_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
