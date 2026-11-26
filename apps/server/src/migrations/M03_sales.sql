-- M03 销售业务迁移：线索、商机、报价、合同、销售单、对账、发货、退货、价格、目标

CREATE TABLE IF NOT EXISTS `crm_lead` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `lead_no` VARCHAR(60) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `source` VARCHAR(50) NULL,
  `score` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'NEW',
  `owner_user_id` BIGINT NULL,
  `customer_id` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_crm_lead_no` (`tenant_id`, `lead_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_opportunity` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `opp_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `stage` VARCHAR(24) NOT NULL DEFAULT 'PROSPECT',
  `expected_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `win_rate` INT NOT NULL DEFAULT 10,
  `owner_user_id` BIGINT NULL,
  `close_date` DATE NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_crm_opportunity_no` (`tenant_id`, `opp_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_follow` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `biz_type` VARCHAR(32) NOT NULL,
  `biz_id` BIGINT NOT NULL,
  `follow_type` VARCHAR(24) NOT NULL DEFAULT 'NOTE',
  `content` VARCHAR(1000) NOT NULL,
  `next_time` DATETIME(3) NULL,
  `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_crm_follow_biz` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_quotation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `quote_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `quote_date` DATE NOT NULL,
  `expire_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_crm_quotation_no` (`tenant_id`, `quote_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_quotation_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `quotation_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `unit_price` DECIMAL(18,4) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_quote_line` (`tenant_id`, `quotation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_contract` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `contract_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_contract_no` (`tenant_id`, `contract_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `order_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `warehouse_id` BIGINT NULL,
  `order_date` DATE NOT NULL,
  `source_type` VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `pay_status` VARCHAR(24) NOT NULL DEFAULT 'UNPAID',
  `ship_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `paid_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `credit_occupied` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_order_no` (`tenant_id`, `order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_order_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NULL,
  `warehouse_id` BIGINT NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `unit_price` DECIMAL(18,4) NOT NULL,
  `discount` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,4) NOT NULL,
  `cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `shipped_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_order_line` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_statement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `statement_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `settled_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `due_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_statement_no` (`tenant_id`, `statement_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shipment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `shipment_no` VARCHAR(60) NOT NULL,
  `order_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `shipped_at` DATETIME(3) NULL,
  `tracking_no` VARCHAR(100) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shipment_no` (`tenant_id`, `shipment_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shipment_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `shipment_id` BIGINT NOT NULL,
  `order_line_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `batch_no` VARCHAR(60) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shipment_line` (`tenant_id`, `shipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_return` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `return_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `order_id` BIGINT NULL,
  `reason` VARCHAR(200) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `refund_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_return_no` (`tenant_id`, `return_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_return_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `return_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL,
  `disposal` VARCHAR(24) NOT NULL DEFAULT 'RESTOCK',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_return_line` (`tenant_id`, `return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_price_agreement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `product_id` BIGINT NULL,
  `category_id` BIGINT NULL,
  `price` DECIMAL(18,4) NOT NULL,
  `qty_step` DECIMAL(18,3) NOT NULL DEFAULT 1,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sale_price_agreement` (`tenant_id`, `customer_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_target` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `org_id` BIGINT NULL,
  `user_id` BIGINT NULL,
  `target_amount` DECIMAL(18,4) NOT NULL,
  `actual_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sale_target` (`tenant_id`, `period`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
