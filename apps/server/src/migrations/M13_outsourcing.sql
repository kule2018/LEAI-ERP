-- M13 委外加工迁移

CREATE TABLE IF NOT EXISTS `outsource_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `outsource_no` VARCHAR(60) NOT NULL, `supplier_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL,
  `warehouse_id` BIGINT NULL, `qty` DECIMAL(18,3) NOT NULL, `unit_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0, `issued_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `received_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_outsource_order_no` (`tenant_id`, `outsource_no`),
  KEY `idx_outsource_order_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `outsource_order_line` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `order_id` BIGINT NOT NULL,
  `material_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL,
  `issued_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `returned_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_outsource_order_line` (`tenant_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
