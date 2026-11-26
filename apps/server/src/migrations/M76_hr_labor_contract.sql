-- M76 人事行政：劳动合同主数据与到期提醒

CREATE TABLE IF NOT EXISTS `hr_labor_contract` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `employee_id` BIGINT NOT NULL,
  `contract_no` VARCHAR(40) NOT NULL,
  `contract_type` VARCHAR(24) NOT NULL DEFAULT 'FIXED',
  `party_a` VARCHAR(120) NULL,
  `sign_date` DATE NULL,
  `effective_date` DATE NOT NULL,
  `expiry_date` DATE NULL,
  `remind_days` INT NOT NULL DEFAULT 30,
  `status` VARCHAR(24) NOT NULL DEFAULT 'EFFECTIVE',
  `renewed_from_id` BIGINT NULL,
  `terminate_date` DATE NULL,
  `terminate_reason` VARCHAR(300) NULL,
  `salary` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_labor_contract_tenant` (`tenant_id`, `status`),
  KEY `idx_hr_labor_contract_employee` (`tenant_id`, `employee_id`),
  KEY `idx_hr_labor_contract_expiry` (`tenant_id`, `expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
