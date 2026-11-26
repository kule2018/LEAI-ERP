-- M43 采购供应域扩展：供应商资质与银行账户、多轮询价授标、需求合并、订单变更与到货计划、
-- 暂估冲销与成本流水、对账差异与红冲、委外损耗、物流轨迹与运费对账、价目表取价、供应商门户协同

ALTER TABLE `pur_quotation`
  ADD COLUMN `round_no` INT NOT NULL DEFAULT 1,
  ADD COLUMN `attachment_url` VARCHAR(255) NULL,
  ADD COLUMN `award_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING';

ALTER TABLE `pur_quotation_quote`
  ADD COLUMN `round_no` INT NOT NULL DEFAULT 1,
  ADD COLUMN `attachment_url` VARCHAR(255) NULL,
  ADD COLUMN `rank_no` INT NOT NULL DEFAULT 0;

ALTER TABLE `purchase_order`
  ADD COLUMN `contract_id` BIGINT NULL,
  ADD COLUMN `frame_flag` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `expected_date` DATE NULL,
  ADD COLUMN `version` INT NOT NULL DEFAULT 1,
  ADD COLUMN `portal_confirmed_at` DATETIME(3) NULL,
  ADD COLUMN `portal_confirmed_by` BIGINT NULL;

ALTER TABLE `goods_receipt`
  ADD COLUMN `receipt_type` VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `scan_mode` VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `difference_reason` VARCHAR(300) NULL;

ALTER TABLE `goods_receipt_line`
  ADD COLUMN `difference_type` VARCHAR(24) NULL,
  ADD COLUMN `origin_qty` DECIMAL(18,3) NOT NULL DEFAULT 0;

ALTER TABLE `vendor_statement`
  ADD COLUMN `difference_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN `difference_reason` VARCHAR(300) NULL,
  ADD COLUMN `reversed_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN `reverse_reason` VARCHAR(300) NULL,
  ADD COLUMN `portal_confirmed_at` DATETIME(3) NULL;

ALTER TABLE `logistics_waybill`
  ADD COLUMN `freight_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN `exception_flag` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `exception_reason` VARCHAR(300) NULL,
  ADD COLUMN `delivered_at` DATETIME(3) NULL,
  ADD COLUMN `signer` VARCHAR(60) NULL;

ALTER TABLE `purchase_price`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 0,
  ADD COLUMN `approval_status` VARCHAR(24) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `version` INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS `supplier_qualification` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `qualification_type` VARCHAR(60) NOT NULL,
  `certificate_no` VARCHAR(100) NULL,
  `issue_date` DATE NULL,
  `expire_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'VALID',
  `file_url` VARCHAR(255) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_qualification` (`tenant_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `supplier_bank_account` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `account_name` VARCHAR(150) NOT NULL,
  `account_no` VARCHAR(100) NOT NULL,
  `bank_name` VARCHAR(100) NOT NULL,
  `bank_code` VARCHAR(60) NULL,
  `tax_no` VARCHAR(60) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_bank_account` (`tenant_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pur_award_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `rfq_id` BIGINT NOT NULL,
  `rfq_line_id` BIGINT NOT NULL,
  `quote_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `round_no` INT NOT NULL DEFAULT 1,
  `total_score` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `rank_no` INT NOT NULL DEFAULT 0,
  `award_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(500) NULL,
  `approved_by` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_pur_award_record` (`tenant_id`, `rfq_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_demand_merge` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `merge_no` VARCHAR(60) NOT NULL,
  `product_id` BIGINT NOT NULL,
  `total_qty` DECIMAL(18,3) NOT NULL,
  `source_demand_ids` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'MERGED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_demand_merge_no` (`tenant_id`, `merge_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_order_change` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `change_type` VARCHAR(32) NOT NULL,
  `diff_detail` JSON NULL,
  `reason` VARCHAR(500) NULL,
  `changed_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_order_change` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_arrival_plan` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `order_line_id` BIGINT NULL,
  `product_id` BIGINT NOT NULL,
  `plan_qty` DECIMAL(18,3) NOT NULL,
  `arrived_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `plan_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_arrival_plan` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_provisional` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `receipt_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ESTIMATED',
  `invoice_amount` DECIMAL(18,4) NULL,
  `reverse_reason` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_provisional` (`tenant_id`, `receipt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_cost_flow` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `receipt_id` BIGINT NOT NULL,
  `product_id` BIGINT NULL,
  `cost_type` VARCHAR(32) NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `allocated_from` VARCHAR(80) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_cost_flow` (`tenant_id`, `receipt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `outsource_loss` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `outsource_id` BIGINT NOT NULL,
  `material_id` BIGINT NULL,
  `issued_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `received_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `loss_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `loss_rate` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(500) NULL,
  `approved_by` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_outsource_loss` (`tenant_id`, `outsource_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `logistics_track_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `waybill_id` BIGINT NOT NULL,
  `node_name` VARCHAR(100) NOT NULL,
  `node_time` DATETIME NOT NULL,
  `location` VARCHAR(150) NULL,
  `source_ref` VARCHAR(80) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_logistics_track_node` (`tenant_id`, `waybill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_price_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `price` DECIMAL(18,4) NOT NULL,
  `source_type` VARCHAR(32) NOT NULL DEFAULT 'PRICE_LIST',
  `source_id` BIGINT NULL,
  `effective_date` DATE NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_price_history` (`tenant_id`, `supplier_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `supplier_portal_action` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL,
  `action_type` VARCHAR(32) NOT NULL,
  `biz_type` VARCHAR(32) NOT NULL,
  `biz_id` BIGINT NULL,
  `content` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_supplier_portal_action` (`tenant_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
