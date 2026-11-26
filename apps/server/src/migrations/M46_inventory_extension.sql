-- M46 库存与仓储扩展：上架策略规则表、库存余额在途量字段

CREATE TABLE IF NOT EXISTS `wms_putaway_strategy` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `warehouse_id` BIGINT NOT NULL DEFAULT 0,
  `strategy_name` VARCHAR(100) NOT NULL,
  `rule_type` VARCHAR(24) NOT NULL,
  `priority` INT NOT NULL DEFAULT 1,
  `rule_value` VARCHAR(120) NOT NULL DEFAULT '',
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wms_putaway_strategy` (`tenant_id`, `warehouse_id`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `stock_balance`
  ADD COLUMN `qty_in_transit` DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER `qty_frozen`;
