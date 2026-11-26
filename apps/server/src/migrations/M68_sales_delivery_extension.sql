-- 销售交付扩展（规范第 3 章补齐）：波次联动 / 物流轨迹 / 异常回单 / 换货 / POS 交接班 / 组合促销 / 对账差异

ALTER TABLE `shipment`
  ADD COLUMN `wave_id` BIGINT NULL COMMENT '关联拣货波次（复核后才可发货）' AFTER `sign_evidence`,
  ADD COLUMN `exception_flag` VARCHAR(16) NOT NULL DEFAULT 'NO' COMMENT '异常标记 NO/HAS_EXCEPTION' AFTER `wave_id`;

ALTER TABLE `sale_return`
  ADD COLUMN `return_type` VARCHAR(24) NOT NULL DEFAULT 'REFUND' COMMENT '退货方式 REFUND/EXCHANGE' AFTER `red_invoice_no`;

ALTER TABLE `customer_statement`
  ADD COLUMN `diff_flag` VARCHAR(16) NOT NULL DEFAULT 'NO' COMMENT '对账差异标记 NO/MINOR/MAJOR' AFTER `status`,
  ADD COLUMN `diff_detail` JSON NULL COMMENT '差异明细与依据' AFTER `diff_flag`,
  ADD COLUMN `ai_suggestion` JSON NULL COMMENT 'AI 对账建议（含依据与置信度）' AFTER `diff_detail`;

ALTER TABLE `sale_order`
  ADD COLUMN `promotion_code` VARCHAR(60) NULL COMMENT '命中的组合促销编码' AFTER `split_batch_no`,
  ADD COLUMN `promotion_discount` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '组合促销优惠金额' AFTER `promotion_code`,
  ADD COLUMN `promotion_detail` JSON NULL COMMENT '组合促销命中明细' AFTER `promotion_discount`;

CREATE TABLE IF NOT EXISTS `shipment_tracking_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `shipment_id` BIGINT NOT NULL,
  `node_code` VARCHAR(32) NOT NULL COMMENT 'CREATED/PICKED/SHIPPED/IN_TRANSIT/OUT_FOR_DELIVERY/DELIVERED/EXCEPTION',
  `node_name` VARCHAR(100) NOT NULL,
  `node_time` DATETIME NOT NULL,
  `location` VARCHAR(120) NULL,
  `operator` VARCHAR(60) NULL,
  `source` VARCHAR(24) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/CARRIER/SYSTEM',
  `remark` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shipment_tracking` (`tenant_id`, `shipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shipment_exception` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `shipment_id` BIGINT NOT NULL,
  `order_id` BIGINT NULL,
  `exception_type` VARCHAR(24) NOT NULL COMMENT 'REJECTED/DAMAGED/LOST/DELAY/SHORTAGE/OTHER',
  `severity` VARCHAR(12) NOT NULL DEFAULT 'LOW' COMMENT 'HIGH/MEDIUM/LOW',
  `description` VARCHAR(500) NOT NULL,
  `evidence` JSON NULL COMMENT '凭证照片',
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/PROCESSING/DONE',
  `return_id` BIGINT NULL COMMENT '转售后生成的退货单',
  `handled_by` BIGINT NULL,
  `handled_at` DATETIME NULL,
  `handle_remark` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shipment_exception` (`tenant_id`, `shipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pos_shift` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `shift_no` VARCHAR(60) NOT NULL,
  `store_name` VARCHAR(100) NOT NULL DEFAULT '',
  `cashier_user_id` BIGINT NULL,
  `open_at` DATETIME NOT NULL,
  `close_at` DATETIME NULL,
  `opening_cash` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '开班备用金',
  `cash_received` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '本班现金收款',
  `other_income` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '其他现金收入',
  `expected_cash` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '应存现金',
  `actual_cash` DECIMAL(18,4) NULL COMMENT '实盘现金',
  `difference_amount` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '现金差异',
  `level` VARCHAR(12) NOT NULL DEFAULT 'OK' COMMENT 'OK/WARN/ALARM',
  `order_count` INT NOT NULL DEFAULT 0,
  `order_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `payment_summary` JSON NULL COMMENT '各支付方式汇总',
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/CLOSED/PENDING_APPROVAL',
  `remark` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pos_shift_no` (`tenant_id`, `shift_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_promotion_bundle` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `promotion_code` VARCHAR(60) NOT NULL,
  `promotion_name` VARCHAR(150) NOT NULL,
  `bundle_type` VARCHAR(24) NOT NULL DEFAULT 'COMBO' COMMENT 'COMBO=套装价 FULL_REDUCTION=满减',
  `threshold_amount` DECIMAL(18,4) NULL COMMENT '满减门槛',
  `discount_amount` DECIMAL(18,4) NULL COMMENT '满减优惠额',
  `combo_price` DECIMAL(18,4) NULL COMMENT '套装价',
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `priority` INT NOT NULL DEFAULT 0,
  `remark` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_promotion_code` (`tenant_id`, `promotion_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_promotion_bundle_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `bundle_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_promotion_item` (`tenant_id`, `bundle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_return_exchange` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `return_id` BIGINT NOT NULL,
  `exchange_order_id` BIGINT NULL COMMENT '换货销售单',
  `exchange_shipment_id` BIGINT NULL COMMENT '换货出库单',
  `exchange_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `exchange_status` VARCHAR(24) NOT NULL DEFAULT 'CREATED',
  `remark` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_return_exchange` (`tenant_id`, `return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
