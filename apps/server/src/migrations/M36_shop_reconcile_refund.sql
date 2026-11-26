-- M36 商城支付：对账差异明细与退款审批

CREATE TABLE IF NOT EXISTS `shop_reconcile_bill` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `bill_no` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(40) NOT NULL,
  `period` VARCHAR(24) NULL,
  `platform_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `local_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `diff_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `diff_reason` VARCHAR(500) NULL,
  `resolved_by` BIGINT NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_reconcile_bill` (`tenant_id`, `store_id`, `bill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_refund` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `shop_order_id` BIGINT NOT NULL,
  `reconcile_bill_id` BIGINT NULL,
  `sale_return_id` BIGINT NULL,
  `refund_no` VARCHAR(60) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reason` VARCHAR(200) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
  `red_invoice_no` VARCHAR(80) NULL,
  `review_note` VARCHAR(500) NULL,
  `reviewed_by` BIGINT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_refund_no` (`tenant_id`, `refund_no`),
  KEY `idx_shop_refund` (`tenant_id`, `store_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
