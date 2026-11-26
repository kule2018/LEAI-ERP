-- 批次效期档案与库存预警自动巡检（安全库存 / 临期 / 呆滞）
CREATE TABLE IF NOT EXISTS `md_batch_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `variant_id` bigint NULL,
  `batch_no` varchar(64) NOT NULL,
  `warehouse_id` bigint NULL,
  `expiry_date` datetime NULL COMMENT '到期日期',
  `shelf_life_days` int NULL COMMENT '保质期天数',
  `qty` decimal(18,4) NOT NULL DEFAULT 0,
  `status` varchar(24) NOT NULL DEFAULT 'NORMAL' COMMENT 'NORMAL/EXPIRING/EXPIRED/FROZEN',
  `remark` varchar(255) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_batch_profile` (`tenant_id`,`product_id`,`batch_no`),
  KEY `idx_md_batch_profile_expiry` (`tenant_id`,`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='批次效期档案';

ALTER TABLE `stock_alert` ADD COLUMN `alert_level` varchar(24) NOT NULL DEFAULT 'INFO' COMMENT '告警级别' AFTER `alert_type`;
ALTER TABLE `stock_alert` ADD COLUMN `batch_no` varchar(64) NULL COMMENT '批次号' AFTER `alert_level`;
