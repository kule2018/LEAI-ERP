-- M41 人事行政扩展：员工档案记录、Offer、薪酬明细、绩效复核、培训记录、资产流水

CREATE TABLE IF NOT EXISTS `hr_employee_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `employee_id` BIGINT NOT NULL,
  `record_type` VARCHAR(24) NOT NULL,
  `record_title` VARCHAR(150) NOT NULL,
  `detail` VARCHAR(500) NULL,
  `effective_date` DATE NULL,
  `expiry_date` DATE NULL,
  `approval_status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_employee_record` (`tenant_id`, `employee_id`, `record_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_offer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `candidate_id` BIGINT NOT NULL,
  `position_name` VARCHAR(100) NOT NULL,
  `salary` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `approved_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_offer` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_payroll_detail` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `salary_id` BIGINT NOT NULL,
  `social` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `payslip_no` VARCHAR(60) NOT NULL,
  `review_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `reviewed_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_payroll_detail` (`tenant_id`, `salary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_performance_review` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `performance_id` BIGINT NOT NULL,
  `kpi_score` INT NOT NULL DEFAULT 0,
  `peer_score` INT NOT NULL DEFAULT 0,
  `calibration` INT NOT NULL DEFAULT 0,
  `level` VARCHAR(12) NOT NULL,
  `appeal_status` VARCHAR(24) NOT NULL DEFAULT 'NONE',
  `appeal_reason` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_performance_review` (`tenant_id`, `performance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_training_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `training_id` BIGINT NOT NULL,
  `employee_id` BIGINT NOT NULL,
  `exam_score` INT NOT NULL DEFAULT 0,
  `passed` TINYINT(1) NOT NULL DEFAULT 0,
  `certificate_no` VARCHAR(60) NULL,
  `signin_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_training_record` (`tenant_id`, `training_id`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_asset_transaction` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `asset_id` BIGINT NOT NULL,
  `action` VARCHAR(24) NOT NULL,
  `from_status` VARCHAR(24) NOT NULL,
  `to_status` VARCHAR(24) NOT NULL,
  `holder_id` BIGINT NULL,
  `note` VARCHAR(300) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_asset_transaction` (`tenant_id`, `asset_id`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
