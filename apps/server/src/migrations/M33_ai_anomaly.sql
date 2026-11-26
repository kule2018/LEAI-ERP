-- M33 AI 异常跟踪

CREATE TABLE IF NOT EXISTS `ai_anomaly` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `scan_task_id` BIGINT NULL,
  `type` VARCHAR(60) NOT NULL,
  `severity` VARCHAR(16) NOT NULL,
  `target` VARCHAR(200) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `evidence` JSON NULL,
  `suggestion` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `assignee_id` BIGINT NULL,
  `closed_by` BIGINT NULL,
  `close_note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ai_anomaly` (`tenant_id`, `status`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
