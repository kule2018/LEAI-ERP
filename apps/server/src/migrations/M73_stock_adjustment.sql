-- M73 库存调整单：盘盈 / 盘亏 / 系统差异修正

CREATE TABLE IF NOT EXISTS `stock_adjustment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `adjust_no` VARCHAR(60) NOT NULL,
  `adjust_type` VARCHAR(16) NOT NULL DEFAULT 'GAIN',
  `warehouse_id` BIGINT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  `total_qty_in` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `total_qty_out` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reason` VARCHAR(300) NULL,
  `posted_at` DATETIME(3) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_adjustment` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_adjustment_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `adjustment_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0,
  `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `qty` DECIMAL(18,4) NOT NULL,
  `cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reason` VARCHAR(300) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stock_adjustment_line` (`adjustment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
