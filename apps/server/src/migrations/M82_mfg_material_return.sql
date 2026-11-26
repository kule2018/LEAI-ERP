-- 生产退料单：退料单主表 + 明细行
CREATE TABLE IF NOT EXISTS `mes_material_return` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `return_no` varchar(60) NOT NULL,
  `work_order_id` bigint NOT NULL,
  `warehouse_id` bigint DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `total_qty` decimal(18,3) NOT NULL DEFAULT 0,
  `reason` varchar(500) DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_mes_material_return_no` (`tenant_id`,`return_no`),
  KEY `idx_mes_material_return` (`tenant_id`,`status`),
  KEY `idx_mes_material_return_order` (`tenant_id`,`work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_material_return_line` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `return_id` bigint NOT NULL,
  `material_id` bigint NOT NULL,
  `qty` decimal(18,3) NOT NULL,
  `batch_no` varchar(60) DEFAULT NULL,
  `remark` varchar(300) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_material_return_line` (`tenant_id`,`return_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
