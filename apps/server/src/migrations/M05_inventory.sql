-- M05 库存仓储迁移：余额、流水、锁定、预警、盘点、调拨、WMS、拆装

CREATE TABLE IF NOT EXISTS `stock_balance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL,
  `location_id` BIGINT NOT NULL DEFAULT 0, `product_id` BIGINT NOT NULL, `variant_id` BIGINT NOT NULL DEFAULT 0,
  `batch_no` VARCHAR(60) NOT NULL DEFAULT '', `qty_on_hand` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `qty_occupied` DECIMAL(18,3) NOT NULL DEFAULT 0, `qty_frozen` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `avg_cost` DECIMAL(18,4) NOT NULL DEFAULT 0, `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_stock_balance` (`tenant_id`, `warehouse_id`, `location_id`, `product_id`, `variant_id`, `batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_ledger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `voucher_type` VARCHAR(40) NOT NULL,
  `voucher_id` BIGINT NOT NULL DEFAULT 0, `voucher_line_id` BIGINT NOT NULL DEFAULT 0,
  `warehouse_id` BIGINT NOT NULL, `location_id` BIGINT NOT NULL DEFAULT 0,
  `product_id` BIGINT NOT NULL, `variant_id` BIGINT NOT NULL DEFAULT 0, `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `qty_in` DECIMAL(18,3) NOT NULL DEFAULT 0, `qty_out` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `qty_delta` DECIMAL(18,3) NOT NULL DEFAULT 0, `balance_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `cost` DECIMAL(18,4) NOT NULL DEFAULT 0, `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `remark` VARCHAR(500) NULL, `operator_id` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), KEY `idx_stock_ledger_dimension` (`tenant_id`, `product_id`, `variant_id`, `warehouse_id`),
  KEY `idx_stock_ledger_voucher` (`tenant_id`, `voucher_type`, `voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_lock` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `source_type` VARCHAR(32) NOT NULL,
  `source_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0, `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `locked_qty` DECIMAL(18,3) NOT NULL, `status` VARCHAR(16) NOT NULL DEFAULT 'LOCKED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_stock_lock_source` (`tenant_id`, `source_type`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_alert` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `alert_type` VARCHAR(32) NOT NULL,
  `product_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL DEFAULT 0,
  `threshold_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `current_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `suggest_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `message` VARCHAR(500) NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_stock_alert` (`tenant_id`, `alert_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stocktake` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `stocktake_no` VARCHAR(60) NOT NULL,
  `warehouse_id` BIGINT NOT NULL, `plan_date` DATE NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_stocktake_no` (`tenant_id`, `stocktake_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stocktake_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `stocktake_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `variant_id` BIGINT NOT NULL DEFAULT 0, `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `book_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `actual_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `diff_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_stocktake_line` (`tenant_id`, `stocktake_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_transfer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `transfer_no` VARCHAR(60) NOT NULL,
  `from_warehouse_id` BIGINT NOT NULL, `to_warehouse_id` BIGINT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_stock_transfer_no` (`tenant_id`, `transfer_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_transfer_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `transfer_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `variant_id` BIGINT NOT NULL DEFAULT 0, `batch_no` VARCHAR(60) NOT NULL DEFAULT '',
  `qty` DECIMAL(18,3) NOT NULL, `received_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_stock_transfer_line` (`tenant_id`, `transfer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wms_putaway` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `source_type` VARCHAR(32) NOT NULL,
  `source_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL, `location_id` BIGINT NOT NULL,
  `strategy_code` VARCHAR(50) NOT NULL DEFAULT 'FIFO', `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_wms_putaway` (`tenant_id`, `source_type`, `source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wms_pick_wave` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `wave_no` VARCHAR(60) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `priority` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_wms_pick_wave_no` (`tenant_id`, `wave_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wms_pick_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `wave_id` BIGINT NOT NULL,
  `source_type` VARCHAR(32) NOT NULL DEFAULT 'SALE_ORDER', `source_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL, `location_id` BIGINT NOT NULL DEFAULT 0,
  `qty` DECIMAL(18,3) NOT NULL, `picked_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_wms_pick_task` (`tenant_id`, `wave_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_assembly` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `assembly_no` VARCHAR(60) NOT NULL,
  `assembly_type` VARCHAR(24) NOT NULL, `product_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_stock_assembly_no` (`tenant_id`, `assembly_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_assembly_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `assembly_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_stock_assembly_line` (`tenant_id`, `assembly_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
