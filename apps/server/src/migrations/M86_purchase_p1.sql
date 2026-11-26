-- P1：MRP 采购需求溯源、采购合同附件、越库直发、供应商罚款
ALTER TABLE `purchase_demand`
  ADD COLUMN `source_id` bigint DEFAULT NULL AFTER `source_type`,
  ADD COLUMN `source_run_no` varchar(60) DEFAULT NULL AFTER `source_id`;

ALTER TABLE `purchase_contract`
  ADD COLUMN `attachment_url` varchar(500) DEFAULT NULL AFTER `total_amount`,
  ADD COLUMN `attachment_name` varchar(200) DEFAULT NULL AFTER `attachment_url`;

CREATE TABLE IF NOT EXISTS `po_crossdock` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `crossdock_no` varchar(60) NOT NULL,
  `supplier_id` bigint NOT NULL,
  `customer_id` bigint DEFAULT NULL,
  `purchase_order_id` bigint DEFAULT NULL,
  `sale_order_id` bigint DEFAULT NULL,
  `product_id` bigint NOT NULL,
  `qty` decimal(18,3) NOT NULL,
  `warehouse_id` bigint DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'PENDING',
  `remark` varchar(300) DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_po_crossdock` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `po_supplier_fine` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `fine_no` varchar(60) NOT NULL,
  `supplier_id` bigint NOT NULL,
  `purchase_order_id` bigint DEFAULT NULL,
  `fine_type` varchar(24) NOT NULL,
  `amount` decimal(18,4) NOT NULL,
  `deducted_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `reason` varchar(500) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'PENDING',
  `approved_by` bigint DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_po_supplier_fine` (`tenant_id`,`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
