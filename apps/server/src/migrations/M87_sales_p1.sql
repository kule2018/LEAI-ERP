-- P1：报价模板与信用动态流水
CREATE TABLE IF NOT EXISTS `sale_quotation_template` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `template_code` varchar(60) NOT NULL,
  `template_name` varchar(150) NOT NULL,
  `customer_id` bigint DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_quote_tpl` (`tenant_id`,`template_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_quotation_template_line` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `template_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `qty` decimal(18,3) NOT NULL,
  `unit_price` decimal(18,4) NOT NULL,
  `remark` varchar(300) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_quote_tpl_line` (`tenant_id`,`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sale_customer_credit_flow` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `flow_type` varchar(16) NOT NULL,
  `amount` decimal(18,4) NOT NULL,
  `before_used` decimal(18,4) NOT NULL DEFAULT 0,
  `after_used` decimal(18,4) NOT NULL DEFAULT 0,
  `source_type` varchar(32) DEFAULT NULL,
  `source_id` bigint DEFAULT NULL,
  `remark` varchar(300) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sale_credit_flow` (`tenant_id`,`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
