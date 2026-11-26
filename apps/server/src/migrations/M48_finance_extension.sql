-- M48 财务结算域扩展：凭证模板与附件、费用政策与 OCR 单据、坏账计提与催收计划、银行流水匹配、
-- 现金流情景与日历、月结检查清单、预算占用；并扩展科目停用、凭证来源、期间反结账、预算占用等字段

CREATE TABLE IF NOT EXISTS `fin_voucher_template` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `template_code` VARCHAR(60) NOT NULL,
  `template_name` VARCHAR(120) NOT NULL,
  `biz_type` VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `items` JSON NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_voucher_template` (`tenant_id`, `template_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_voucher_attachment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `voucher_id` BIGINT NOT NULL,
  `file_name` VARCHAR(200) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `attachment_type` VARCHAR(32) NOT NULL DEFAULT 'OTHER',
  `uploaded_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_voucher_attachment` (`tenant_id`, `voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_expense_policy` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `policy_code` VARCHAR(60) NOT NULL,
  `policy_name` VARCHAR(120) NOT NULL,
  `category` VARCHAR(32) NULL,
  `max_amount` DECIMAL(18,4) NULL,
  `require_invoice` TINYINT(1) NOT NULL DEFAULT 0,
  `require_approval` TINYINT(1) NOT NULL DEFAULT 0,
  `keywords` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_expense_policy` (`tenant_id`, `policy_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_expense_claim` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `claim_no` VARCHAR(60) NOT NULL,
  `dept_id` BIGINT NULL,
  `direction` VARCHAR(16) NOT NULL DEFAULT 'OUT',
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `occurred_at` DATE NULL,
  `summary` VARCHAR(300) NULL,
  `counterparty` VARCHAR(120) NULL,
  `source_text` TEXT NULL,
  `ocr_result` JSON NULL,
  `policy_id` BIGINT NULL,
  `policy_level` VARCHAR(16) NOT NULL DEFAULT 'PASS',
  `has_invoice` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_expense_claim` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_bad_debt_provision` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `customer_name` VARCHAR(120) NULL,
  `aging_bucket` VARCHAR(16) NOT NULL DEFAULT 'CURRENT',
  `receivable_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `provision_rate` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `provision_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(500) NULL,
  `submitted_by` BIGINT NULL,
  `approved_by` BIGINT NULL,
  `approved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_bad_debt` (`tenant_id`, `period`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_collection_plan` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `customer_name` VARCHAR(120) NULL,
  `receivable_id` BIGINT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `overdue_days` INT NOT NULL DEFAULT 0,
  `risk_level` VARCHAR(16) NOT NULL DEFAULT 'LOW',
  `suggestion` VARCHAR(300) NULL,
  `action` VARCHAR(100) NULL,
  `planned_at` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_collection_plan` (`tenant_id`, `customer_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_bank_match` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `transaction_id` BIGINT NOT NULL,
  `external_no` VARCHAR(100) NULL,
  `biz_type` VARCHAR(32) NULL,
  `biz_id` BIGINT NULL,
  `score` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `difference` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reason` VARCHAR(300) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'SUGGESTED',
  `matched_by` BIGINT NULL,
  `matched_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_bank_match` (`tenant_id`, `transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_cashflow_scenario` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `scenario_name` VARCHAR(120) NOT NULL,
  `scenario_type` VARCHAR(24) NOT NULL DEFAULT 'BASE',
  `inflow_factor` DECIMAL(10,4) NOT NULL DEFAULT 1,
  `outflow_factor` DECIMAL(10,4) NOT NULL DEFAULT 1,
  `one_off` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `remark` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_cashflow_scenario` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_cashflow_calendar` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `scenario_id` BIGINT NULL,
  `biz_date` DATE NOT NULL,
  `direction` VARCHAR(16) NOT NULL DEFAULT 'IN',
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `summary` VARCHAR(300) NULL,
  `source_type` VARCHAR(32) NULL,
  `source_id` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_cashflow_calendar` (`tenant_id`, `biz_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_period_check` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `check_code` VARCHAR(60) NOT NULL,
  `check_name` VARCHAR(120) NOT NULL,
  `passed` TINYINT(1) NOT NULL DEFAULT 0,
  `detail` VARCHAR(500) NULL,
  `severity` VARCHAR(16) NOT NULL DEFAULT 'BLOCK',
  `checked_by` BIGINT NULL,
  `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_period_check` (`tenant_id`, `period`, `check_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_budget_occupation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `budget_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `dept_id` BIGINT NULL,
  `subject_id` BIGINT NULL,
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `biz_type` VARCHAR(32) NULL,
  `biz_id` BIGINT NULL,
  `released` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_budget_occupation` (`tenant_id`, `period`, `released`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `account_subject`
  ADD COLUMN `disable_reason` VARCHAR(200) NULL DEFAULT NULL,
  ADD COLUMN `disabled_at` DATETIME(3) NULL DEFAULT NULL;

ALTER TABLE `voucher`
  ADD COLUMN `template_id` BIGINT NULL DEFAULT NULL,
  ADD COLUMN `ai_suggested` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `check_status` VARCHAR(24) NOT NULL DEFAULT 'PASS';

ALTER TABLE `receivable`
  ADD COLUMN `last_contact_at` DATETIME(3) NULL DEFAULT NULL,
  ADD COLUMN `risk_level` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN `provision_amount` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `fin_period`
  ADD COLUMN `check_status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `reopen_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `reopened_by` BIGINT NULL DEFAULT NULL,
  ADD COLUMN `reopened_at` DATETIME(3) NULL DEFAULT NULL;

ALTER TABLE `fin_budget`
  ADD COLUMN `occupied_amount` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `fin_bank_transaction`
  ADD COLUMN `match_target_type` VARCHAR(32) NULL DEFAULT NULL,
  ADD COLUMN `match_target_id` BIGINT NULL DEFAULT NULL,
  ADD COLUMN `match_score` DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN `matched_at` DATETIME(3) NULL DEFAULT NULL;

ALTER TABLE `fin_cost_job`
  ADD COLUMN `snapshot` JSON NULL DEFAULT NULL,
  ADD COLUMN `rollback_status` VARCHAR(24) NULL DEFAULT NULL,
  ADD COLUMN `rolled_back_at` DATETIME(3) NULL DEFAULT NULL;
