-- M45 采购域扩展（第三批）：三方匹配证据链、框架协议版本、供应商准入黑名单

CREATE TABLE IF NOT EXISTS `purchase_match_evidence` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `receipt_id` BIGINT NOT NULL,
  `receipt_no` VARCHAR(60) NOT NULL,
  `order_id` BIGINT NULL,
  `order_no` VARCHAR(60) NULL,
  `invoice_id` BIGINT NULL,
  `invoice_no` VARCHAR(60) NULL,
  `product_id` BIGINT NOT NULL,
  `order_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `receipt_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `invoice_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `order_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `invoice_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'MATCHED',
  `issues` JSON NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_match_evidence` (`tenant_id`, `receipt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_frame_agreement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `agreement_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `product_id` BIGINT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `parent_id` BIGINT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `total_qty` DECIMAL(18,3) NULL,
  `used_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `change_reason` VARCHAR(300) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_frame_agreement` (`tenant_id`, `agreement_no`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_supplier_blacklist` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `supplier_name` VARCHAR(150) NULL,
  `level` VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  `reason` VARCHAR(300) NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_supplier_blacklist` (`tenant_id`, `supplier_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
