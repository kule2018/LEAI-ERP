-- M44 销售域扩展（第二批）：客户 360 联系人图谱与流失预警、报价版本快照与对比、
-- POS 会员价与多支付流水、销售目标达成预警、退货红字发票

CREATE TABLE IF NOT EXISTS `crm_customer_contact` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `contact_name` VARCHAR(100) NOT NULL,
  `contact_role` VARCHAR(60) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(120) NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_crm_customer_contact` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_churn_warning` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `customer_name` VARCHAR(150) NULL,
  `level` VARCHAR(16) NOT NULL DEFAULT 'LOW',
  `score` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `risk_detail` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `handled_by` BIGINT NULL,
  `handled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_crm_churn_warning` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_quotation_version` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `quotation_id` BIGINT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `snapshot` JSON NOT NULL,
  `change_reason` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_crm_quotation_version` (`tenant_id`, `quotation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pos_member_price` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `member_level` VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  `price` DECIMAL(18,4) NOT NULL,
  `effective_date` DATE NULL,
  `expire_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_pos_member_price` (`tenant_id`, `customer_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pos_payment_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `pay_type` VARCHAR(24) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `trade_no` VARCHAR(80) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'SUCCESS',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_pos_payment_record` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_red_invoice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `return_id` BIGINT NULL,
  `origin_invoice_no` VARCHAR(80) NULL,
  `invoice_no` VARCHAR(80) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `tax_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `invoice_type` VARCHAR(16) NOT NULL DEFAULT 'RED',
  `reason` VARCHAR(300) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_red_invoice_no` (`tenant_id`, `invoice_no`),
  KEY `idx_sale_red_invoice` (`tenant_id`, `return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
