-- M56 库存预警策略与关闭留痕

-- 预警关闭需记录原因（规范：风险预警中心关闭需原因）
ALTER TABLE `stock_alert`
  ADD COLUMN `close_reason` varchar(500) NULL COMMENT '关闭原因' AFTER `message`,
  ADD COLUMN `closed_by` bigint NULL COMMENT '关闭人' AFTER `close_reason`,
  ADD COLUMN `closed_at` datetime NULL COMMENT '关闭时间' AFTER `closed_by`;

-- 库存预警策略：临期阈值、安全库存、呆滞天数
CREATE TABLE IF NOT EXISTS `md_stock_alert_policy` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `product_id` bigint NOT NULL DEFAULT 0 COMMENT '0 表示全局默认策略',
  `warehouse_id` bigint NOT NULL DEFAULT 0 COMMENT '0 表示全部仓库',
  `warn_days` int NOT NULL DEFAULT 30 COMMENT '临期预警天数',
  `urgent_days` int NOT NULL DEFAULT 7 COMMENT '紧急临期天数',
  `safety_stock` decimal(18,4) NOT NULL DEFAULT 0 COMMENT '安全库存，0 表示不启用',
  `slow_moving_days` int NOT NULL DEFAULT 0 COMMENT '呆滞库存天数阈值，0 表示不启用',
  `status` varchar(24) NOT NULL DEFAULT 'ENABLED',
  `remark` varchar(255) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_stock_alert_policy` (`tenant_id`, `product_id`, `warehouse_id`),
  KEY `idx_md_stock_alert_policy_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警策略';
