-- 库存出入库单：多类型 + 暂估 + 冲销 + 附件
CREATE TABLE IF NOT EXISTS `stock_io_document` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `doc_no` varchar(40) NOT NULL,
  `io_type` varchar(32) NOT NULL,
  `direction` varchar(8) NOT NULL,
  `source_type` varchar(40) NOT NULL DEFAULT '',
  `source_id` bigint NOT NULL DEFAULT 0,
  `warehouse_id` bigint NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `provisional_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `cost_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `reversal_of_id` bigint NOT NULL DEFAULT 0,
  `reversal_reason` varchar(300) DEFAULT NULL,
  `doc_date` date DEFAULT NULL,
  `remark` varchar(300) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `posted_by` bigint DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `reversed_by` bigint DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stock_io_document_no` (`tenant_id`,`doc_no`),
  KEY `idx_stock_io_document_status` (`tenant_id`,`status`),
  KEY `idx_stock_io_document_source` (`tenant_id`,`source_type`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_io_line` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `doc_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `variant_id` bigint NOT NULL DEFAULT 0,
  `location_id` bigint NOT NULL DEFAULT 0,
  `batch_no` varchar(60) NOT NULL DEFAULT '',
  `qty_in` decimal(18,3) NOT NULL DEFAULT 0,
  `qty_out` decimal(18,3) NOT NULL DEFAULT 0,
  `unit_cost` decimal(18,4) NOT NULL DEFAULT 0,
  `amount` decimal(18,4) NOT NULL DEFAULT 0,
  `is_provisional` tinyint(1) NOT NULL DEFAULT 0,
  `remark` varchar(300) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_io_line_doc` (`tenant_id`,`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_io_attachment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `doc_id` bigint NOT NULL,
  `file_name` varchar(200) NOT NULL,
  `file_url` varchar(500) NOT NULL DEFAULT '',
  `file_size` bigint NOT NULL DEFAULT 0,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_io_attachment_doc` (`tenant_id`,`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
