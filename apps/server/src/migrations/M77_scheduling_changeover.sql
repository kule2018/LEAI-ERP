-- M77 生产排产：换线时间主数据与换线记录

CREATE TABLE IF NOT EXISTS `mes_changeover_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `work_center_id` BIGINT NULL,
  `from_product_id` BIGINT NULL,
  `to_product_id` BIGINT NULL,
  `minutes` INT NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_changeover_rule` (`tenant_id`, `work_center_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_changeover_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `plan_task_id` BIGINT NOT NULL,
  `work_center_id` BIGINT NULL,
  `from_product_id` BIGINT NULL,
  `to_product_id` BIGINT NULL,
  `minutes` INT NOT NULL DEFAULT 0,
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  `source` VARCHAR(16) NOT NULL DEFAULT 'AUTO',
  `operator_id` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_changeover_log` (`tenant_id`, `work_center_id`),
  KEY `idx_mes_changeover_log_task` (`tenant_id`, `plan_task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
