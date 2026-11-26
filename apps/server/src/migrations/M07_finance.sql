-- M07 财务结算迁移：科目、账户、凭证、应收应付、收付款、发票、资产、期间、成本、预算

CREATE TABLE IF NOT EXISTS `account_subject` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `subject_code` VARCHAR(50) NOT NULL, `subject_name` VARCHAR(100) NOT NULL, `parent_id` BIGINT NULL,
  `category` VARCHAR(24) NOT NULL, `direction` VARCHAR(10) NOT NULL DEFAULT 'DEBIT',
  `aux_type` VARCHAR(50) NULL, `is_leaf` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED', `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_account_subject_code` (`tenant_id`, `subject_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_account` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `account_code` VARCHAR(50) NOT NULL, `account_name` VARCHAR(100) NOT NULL,
  `account_type` VARCHAR(24) NOT NULL DEFAULT 'BANK', `currency_code` VARCHAR(10) NOT NULL DEFAULT 'CNY',
  `balance` DECIMAL(18,4) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_fin_account_code` (`tenant_id`, `account_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `voucher` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `voucher_no` VARCHAR(60) NOT NULL,
  `voucher_date` DATE NOT NULL, `period` VARCHAR(20) NOT NULL,
  `source_type` VARCHAR(32) NULL, `source_id` BIGINT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `total_debit` DECIMAL(18,4) NOT NULL DEFAULT 0, `total_credit` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `posted_at` DATETIME(3) NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0, `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_voucher_no` (`tenant_id`, `voucher_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `voucher_entry` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `voucher_id` BIGINT NOT NULL,
  `line_no` INT NOT NULL DEFAULT 1, `subject_id` BIGINT NOT NULL, `summary` VARCHAR(300) NOT NULL,
  `debit` DECIMAL(18,4) NOT NULL DEFAULT 0, `credit` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `period` VARCHAR(20) NOT NULL, `aux_type` VARCHAR(50) NULL, `aux_id` VARCHAR(60) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_voucher_entry` (`tenant_id`, `voucher_id`),
  KEY `idx_voucher_entry_subject` (`tenant_id`, `subject_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `receivable` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `customer_id` BIGINT NOT NULL,
  `source_type` VARCHAR(32) NULL, `source_id` BIGINT NULL, `source_no` VARCHAR(60) NULL,
  `amount` DECIMAL(18,4) NOT NULL, `received_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `due_date` DATE NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_receivable_customer` (`tenant_id`, `customer_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payable` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `supplier_id` BIGINT NOT NULL,
  `source_type` VARCHAR(32) NULL, `source_id` BIGINT NULL, `source_no` VARCHAR(60) NULL,
  `amount` DECIMAL(18,4) NOT NULL, `paid_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `due_date` DATE NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_payable_supplier` (`tenant_id`, `supplier_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_receipt` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `receipt_no` VARCHAR(60) NOT NULL,
  `customer_id` BIGINT NOT NULL, `account_id` BIGINT NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `received_at` DATE NOT NULL, `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_receipt_customer` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_payment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `payment_no` VARCHAR(60) NOT NULL,
  `supplier_id` BIGINT NOT NULL, `account_id` BIGINT NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `paid_at` DATE NOT NULL, `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_payment_supplier` (`tenant_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_writeoff` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `biz_type` VARCHAR(24) NOT NULL,
  `biz_id` BIGINT NOT NULL, `writeoff_type` VARCHAR(24) NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `reason` VARCHAR(300) NULL, `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_writeoff` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_invoice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `invoice_no` VARCHAR(80) NOT NULL,
  `invoice_type` VARCHAR(32) NOT NULL, `biz_type` VARCHAR(32) NULL, `biz_id` BIGINT NULL,
  `amount` DECIMAL(18,4) NOT NULL, `tax_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_invoice_no` (`tenant_id`, `invoice_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_asset` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `asset_no` VARCHAR(60) NOT NULL,
  `asset_name` VARCHAR(150) NOT NULL, `purchase_date` DATE NULL,
  `original_value` DECIMAL(18,4) NOT NULL, `depreciated_value` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `useful_months` INT NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_fin_asset_no` (`tenant_id`, `asset_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_asset_depreciation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `asset_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_depreciation` (`tenant_id`, `asset_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_period` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `period` VARCHAR(20) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN', `closed_by` BIGINT NULL, `closed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_fin_period` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_cost` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL, `cost_type` VARCHAR(32) NOT NULL, `amount` DECIMAL(18,4) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_cost` (`tenant_id`, `product_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_budget` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `period` VARCHAR(20) NOT NULL,
  `dept_id` BIGINT NULL, `subject_id` BIGINT NULL,
  `budget_amount` DECIMAL(18,4) NOT NULL, `used_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `control_rule` VARCHAR(24) NOT NULL DEFAULT 'WARN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_fin_budget` (`tenant_id`, `period`, `dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
