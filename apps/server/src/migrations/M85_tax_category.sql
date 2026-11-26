-- P1：税码税率、税务申报汇总、费用/收入类别主数据
CREATE TABLE IF NOT EXISTS `fin_tax_code` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `tax_code` varchar(40) NOT NULL,
  `tax_name` varchar(120) NOT NULL,
  `tax_type` varchar(20) NOT NULL,
  `rate` decimal(8,6) NOT NULL,
  `direction` varchar(16) NOT NULL DEFAULT 'BOTH',
  `subject_id` bigint DEFAULT NULL,
  `remark` varchar(300) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_tax_code` (`tenant_id`,`tax_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_tax_declaration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `period` varchar(20) NOT NULL,
  `declaration_no` varchar(60) NOT NULL,
  `total_output_tax` decimal(18,4) NOT NULL DEFAULT 0,
  `total_input_tax` decimal(18,4) NOT NULL DEFAULT 0,
  `tax_payable` decimal(18,4) NOT NULL DEFAULT 0,
  `details` json DEFAULT NULL,
  `declared_at` datetime DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_tax_decl` (`tenant_id`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fin_category` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `category_type` varchar(16) NOT NULL,
  `category_code` varchar(40) NOT NULL,
  `category_name` varchar(120) NOT NULL,
  `parent_code` varchar(40) DEFAULT NULL,
  `subject_id` bigint DEFAULT NULL,
  `sort_no` int NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_category` (`tenant_id`,`category_type`,`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
