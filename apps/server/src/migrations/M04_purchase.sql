-- M04 采购业务迁移：评级、询价、需求、订单、收货、对账、退货、合同、价格、物流

CREATE TABLE IF NOT EXISTS `sup_evaluate` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `supplier_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `quality_score` DECIMAL(5,2) NOT NULL DEFAULT 0, `delivery_score` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `price_score` DECIMAL(5,2) NOT NULL DEFAULT 0, `service_score` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `total_score` DECIMAL(5,2) NOT NULL DEFAULT 0, `level` VARCHAR(12) NOT NULL DEFAULT 'B',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_sup_evaluate` (`tenant_id`, `supplier_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pur_quotation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `rfq_no` VARCHAR(60) NOT NULL,
  `project_name` VARCHAR(150) NOT NULL, `quote_deadline` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_pur_quotation_no` (`tenant_id`, `rfq_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pur_quotation_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `rfq_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL, `target_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_pur_quote_line` (`tenant_id`, `rfq_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pur_quotation_quote` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `rfq_line_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL, `price` DECIMAL(18,4) NOT NULL, `lead_days` INT NOT NULL DEFAULT 0,
  `score` DECIMAL(5,2) NOT NULL DEFAULT 0, `awarded` VARCHAR(16) NOT NULL DEFAULT 'NO',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_pur_quote_supplier` (`tenant_id`, `rfq_line_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_demand` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `demand_no` VARCHAR(60) NOT NULL,
  `product_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL, `source_type` VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_purchase_demand_no` (`tenant_id`, `demand_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `order_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL, `warehouse_id` BIGINT NULL, `order_date` DATE NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `pay_status` VARCHAR(24) NOT NULL DEFAULT 'UNPAID',
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0, `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0, `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_purchase_order_no` (`tenant_id`, `order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_order_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `order_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `variant_id` BIGINT NULL, `warehouse_id` BIGINT NULL,
  `qty` DECIMAL(18,3) NOT NULL, `unit_price` DECIMAL(18,4) NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `received_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_purchase_order_line` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `goods_receipt` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `receipt_no` VARCHAR(60) NOT NULL,
  `order_id` BIGINT NOT NULL, `supplier_id` BIGINT NOT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `received_at` DATETIME(3) NULL, `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_goods_receipt_no` (`tenant_id`, `receipt_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `goods_receipt_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `receipt_id` BIGINT NOT NULL,
  `order_line_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL,
  `batch_no` VARCHAR(60) NULL, `serial_no` VARCHAR(100) NULL,
  `qc_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_receipt_line` (`tenant_id`, `receipt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vendor_statement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `statement_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL, `period` VARCHAR(20) NOT NULL, `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `settled_amount` DECIMAL(18,4) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_vendor_statement_no` (`tenant_id`, `statement_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_return` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `return_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL, `receipt_id` BIGINT NULL, `reason` VARCHAR(200) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `refund_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_purchase_return_no` (`tenant_id`, `return_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_return_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `return_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_purchase_return_line` (`tenant_id`, `return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_contract` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `contract_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL, `title` VARCHAR(150) NOT NULL, `start_date` DATE NULL, `end_date` DATE NULL,
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_purchase_contract_no` (`tenant_id`, `contract_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_price` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `supplier_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `price` DECIMAL(18,4) NOT NULL, `start_date` DATE NULL, `end_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), KEY `idx_purchase_price` (`tenant_id`, `supplier_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `logistics_carrier` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `carrier_code` VARCHAR(50) NOT NULL,
  `carrier_name` VARCHAR(100) NOT NULL, `contact_phone` VARCHAR(30) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_logistics_carrier_code` (`tenant_id`, `carrier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `logistics_waybill` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `waybill_no` VARCHAR(80) NOT NULL,
  `carrier_id` BIGINT NOT NULL, `source_type` VARCHAR(32) NULL, `source_id` BIGINT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_logistics_waybill_no` (`tenant_id`, `waybill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
