-- M20 风险预警中心

CREATE TABLE IF NOT EXISTS `risk_alert` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `risk_key` VARCHAR(200) NOT NULL COMMENT '去重键 类型:业务类型:业务ID',
  `risk_type` VARCHAR(40) NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL,
  `biz_id` BIGINT NOT NULL,
  `severity` VARCHAR(16) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `evidence` JSON NULL,
  `suggestion` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `assignee_id` BIGINT NULL,
  `closed_by` BIGINT NULL,
  `close_reason` VARCHAR(500) NULL,
  `closed_at` DATETIME(3) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_risk_key` (`tenant_id`, `risk_key`),
  KEY `idx_risk_tenant_status` (`tenant_id`, `status`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
