-- M11 系统管理组织域迁移

CREATE TABLE IF NOT EXISTS `sys_company` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `company_code` VARCHAR(60) NOT NULL, `company_name` VARCHAR(150) NOT NULL,
  `credit_code` VARCHAR(50) NULL, `legal_person` VARCHAR(60) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_company_code` (`tenant_id`, `company_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_org` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `company_id` BIGINT NOT NULL,
  `parent_id` BIGINT NULL, `org_code` VARCHAR(60) NOT NULL, `org_name` VARCHAR(150) NOT NULL,
  `org_type` VARCHAR(24) NOT NULL DEFAULT 'ORG', `sort_no` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_org_code` (`tenant_id`, `org_code`),
  KEY `idx_sys_org_parent` (`tenant_id`, `parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_dept` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `org_id` BIGINT NOT NULL,
  `parent_id` BIGINT NULL, `dept_code` VARCHAR(60) NOT NULL, `dept_name` VARCHAR(150) NOT NULL,
  `leader_user_id` BIGINT NULL, `sort_no` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_dept_code` (`tenant_id`, `dept_code`),
  KEY `idx_sys_dept_parent` (`tenant_id`, `parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_position` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `org_id` BIGINT NOT NULL,
  `dept_id` BIGINT NULL, `position_code` VARCHAR(60) NOT NULL, `position_name` VARCHAR(150) NOT NULL,
  `grade` VARCHAR(24) NOT NULL DEFAULT 'P1', `sort_no` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_sys_position_code` (`tenant_id`, `position_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
