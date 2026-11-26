-- M75 库存成本核算：成本核算方法主数据 / 成本层 / 成本重算期间锁

-- 1. 产品主数据增加成本核算方法（默认移动加权平均）
ALTER TABLE `product`
  ADD COLUMN `costing_method` VARCHAR(24) NOT NULL DEFAULT 'MOVING_WEIGHTED';

-- 2. 库存成本层（一次入库形成的成本批次）
CREATE TABLE IF NOT EXISTS `stock_cost_layer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `warehouse_id` BIGINT NOT NULL,
  `location_id` BIGINT NOT NULL DEFAULT 0,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0,
  `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `qty_in` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `qty_available` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `unit_cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `source_voucher_type` VARCHAR(40) NOT NULL DEFAULT '',
  `source_voucher_id` BIGINT NOT NULL DEFAULT 0,
  `source_voucher_line_id` BIGINT NOT NULL DEFAULT 0,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_cost_layer_dim` (`tenant_id`, `product_id`, `warehouse_id`, `batch_no`),
  KEY `idx_stock_cost_layer_status` (`tenant_id`, `status`),
  KEY `idx_stock_cost_layer_src` (`tenant_id`, `source_voucher_type`, `source_voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 成本重算期间锁
CREATE TABLE IF NOT EXISTS `fin_cost_period_lock` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `lock_status` VARCHAR(20) NOT NULL DEFAULT 'LOCKED',
  `reason` VARCHAR(300) NULL,
  `locked_by` BIGINT NULL,
  `locked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_cost_period_lock` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
