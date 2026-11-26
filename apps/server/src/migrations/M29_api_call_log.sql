-- M29 OpenAPI 调用日志

CREATE TABLE IF NOT EXISTS `sys_api_call_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `api_key_id` BIGINT NOT NULL,
  `method` VARCHAR(10) NOT NULL,
  `path` VARCHAR(300) NOT NULL,
  `status` INT NOT NULL DEFAULT 200,
  `duration_ms` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_api_call_log` (`tenant_id`, `api_key_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
