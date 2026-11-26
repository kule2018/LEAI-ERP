-- M72 财务期间与总账补齐：期末结转批次、资金账户间转账、固定资产变更留痕

CREATE TABLE IF NOT EXISTS `fin_period_carry` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `voucher_id` BIGINT NOT NULL,
  `total_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `profit_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `subject_count` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DONE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_period_carry` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_account_transfer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `transfer_no` VARCHAR(60) NOT NULL,
  `from_account_id` BIGINT NOT NULL,
  `to_account_id` BIGINT NOT NULL,
  `amount` DECIMAL(18,4) NOT NULL,
  `transfer_date` DATE NOT NULL,
  `voucher_id` BIGINT NULL,
  `remark` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_account_transfer` (`tenant_id`, `transfer_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_asset_change` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `asset_id` BIGINT NOT NULL,
  `change_type` VARCHAR(32) NOT NULL,
  `before_value` JSON NULL,
  `after_value` JSON NULL,
  `changes` JSON NULL,
  `reason` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_asset_change` (`tenant_id`, `asset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
