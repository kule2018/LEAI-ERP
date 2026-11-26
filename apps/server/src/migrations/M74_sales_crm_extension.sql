-- M74 销售扩展：佣金规则 / 佣金核算 / 投诉工单 / 客户回访

CREATE TABLE IF NOT EXISTS `sales_commission_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `rule_code` VARCHAR(60) NOT NULL,
  `rule_name` VARCHAR(120) NOT NULL,
  `rule_type` VARCHAR(16) NOT NULL DEFAULT 'RATE',
  `rate` DECIMAL(18,6) NULL,
  `fixed_amount` DECIMAL(18,4) NULL,
  `tiers` JSON NULL,
  `sales_rep_id` BIGINT NULL,
  `effective_from` DATE NULL,
  `effective_to` DATE NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_commission_rule` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sales_commission_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `rule_id` BIGINT NOT NULL,
  `order_id` BIGINT NULL,
  `order_no` VARCHAR(60) NULL,
  `sales_rep_id` BIGINT NULL,
  `order_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `return_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `commission_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `period` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `remark` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_commission_record` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sales_complaint` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `complaint_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `order_id` BIGINT NULL,
  `complaint_type` VARCHAR(24) NOT NULL DEFAULT 'SERVICE',
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `severity` VARCHAR(12) NOT NULL DEFAULT 'MEDIUM',
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `assignee_id` BIGINT NULL,
  `resolution` VARCHAR(500) NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_complaint` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sales_visit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `visit_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `sales_rep_id` BIGINT NULL,
  `visit_date` DATE NOT NULL,
  `channel` VARCHAR(20) NOT NULL DEFAULT 'PHONE',
  `content` TEXT NULL,
  `feedback` VARCHAR(500) NULL,
  `next_visit_at` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DONE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_visit` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
