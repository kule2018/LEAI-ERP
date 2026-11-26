-- 期初余额表：科目余额表 / 明细账的期初余额来源
CREATE TABLE IF NOT EXISTS `fin_opening_balance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `period` varchar(20) NOT NULL,
  `subject_id` bigint NOT NULL,
  `aux_type` varchar(32) NOT NULL DEFAULT '',
  `aux_id` varchar(64) NOT NULL DEFAULT '',
  `direction` varchar(16) NOT NULL DEFAULT 'DEBIT',
  `amount` decimal(18,4) NOT NULL DEFAULT 0,
  `remark` varchar(300) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_opening_balance` (`tenant_id`,`period`,`subject_id`,`aux_id`),
  KEY `idx_fin_opening_balance_period` (`tenant_id`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 银企直连连接配置
CREATE TABLE IF NOT EXISTS `fin_bank_connection` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `account_id` bigint NOT NULL,
  `bank_name` varchar(100) NOT NULL,
  `account_no` varchar(60) DEFAULT NULL,
  `connector` varchar(24) NOT NULL DEFAULT 'MOCK',
  `credentials` json DEFAULT NULL,
  `config` json DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
  `last_sync_at` datetime DEFAULT NULL,
  `last_balance` decimal(18,4) DEFAULT NULL,
  `last_result` varchar(500) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_bank_connection_account` (`tenant_id`,`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 存货成本汇总（移动加权收发存）
CREATE TABLE IF NOT EXISTS `fin_inventory_costing` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `period` varchar(20) NOT NULL,
  `product_id` bigint NOT NULL,
  `product_name` varchar(120) DEFAULT NULL,
  `method` varchar(24) NOT NULL DEFAULT 'MOVING_WEIGHTED',
  `opening_qty` decimal(18,4) NOT NULL DEFAULT 0,
  `opening_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `in_qty` decimal(18,4) NOT NULL DEFAULT 0,
  `in_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `out_qty` decimal(18,4) NOT NULL DEFAULT 0,
  `out_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `closing_qty` decimal(18,4) NOT NULL DEFAULT 0,
  `closing_amount` decimal(18,4) NOT NULL DEFAULT 0,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fin_inventory_costing` (`tenant_id`,`period`,`product_id`),
  KEY `idx_fin_inventory_costing_period` (`tenant_id`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
