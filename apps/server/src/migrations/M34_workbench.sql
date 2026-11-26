-- M34 工作台：角色 KPI、订阅推送、经营简报

CREATE TABLE IF NOT EXISTS `sys_workbench_kpi` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(48) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `source` VARCHAR(24) NOT NULL,
  `roles` JSON NULL,
  `sort_no` INT NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workbench_kpi` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_workbench_subscription` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `resource` VARCHAR(40) NOT NULL,
  `frequency` VARCHAR(16) NOT NULL DEFAULT 'DAILY',
  `channel` VARCHAR(24) NOT NULL DEFAULT 'INBOX',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workbench_subscription` (`tenant_id`, `user_id`, `resource`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_workbench_briefing` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `type` VARCHAR(16) NOT NULL,
  `period` VARCHAR(24) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `template` VARCHAR(40) NULL,
  `snapshot` JSON NULL,
  `summary` TEXT NULL,
  `source_refs` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `pdf_content` TEXT NULL,
  `read_by` JSON NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_workbench_briefing` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
