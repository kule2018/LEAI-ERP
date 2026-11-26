-- M25 设备点检、资产盘点处置、成本重算任务

CREATE TABLE IF NOT EXISTS `equipment_inspection` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `equipment_id` BIGINT NOT NULL,
  `inspect_at` DATETIME(3) NULL,
  `availability` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `performance_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `quality_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `oee` DECIMAL(5,4) NOT NULL DEFAULT 0,
  `result` VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  `remark` VARCHAR(500) NULL,
  `inspector_id` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_equipment_inspection` (`tenant_id`, `equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_cost_job` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `progress` INT NOT NULL DEFAULT 0,
  `total_items` INT NOT NULL DEFAULT 0,
  `error_message` VARCHAR(1000) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fin_cost_job` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `fin_asset`
  ADD COLUMN `book_quantity` INT NOT NULL DEFAULT 1 COMMENT '账面数量' AFTER `useful_months`,
  ADD COLUMN `actual_quantity` INT NULL COMMENT '实盘数量' AFTER `book_quantity`,
  ADD COLUMN `last_stocktake` DATE NULL COMMENT '最近盘点日' AFTER `actual_quantity`,
  ADD COLUMN `dispose_date` DATE NULL COMMENT '处置日期' AFTER `last_stocktake`,
  ADD COLUMN `dispose_amount` DECIMAL(18,4) NULL COMMENT '处置金额' AFTER `dispose_date`;
