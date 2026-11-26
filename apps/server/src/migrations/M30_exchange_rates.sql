-- M30 多币种汇率

CREATE TABLE IF NOT EXISTS `sys_exchange_rate` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `from_currency` VARCHAR(3) NOT NULL,
  `to_currency` VARCHAR(3) NOT NULL,
  `rate` DECIMAL(18,6) NOT NULL,
  `effective_date` DATE NOT NULL,
  `source` VARCHAR(40) NULL,
  `changed_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exchange_rate` (`tenant_id`, `from_currency`, `to_currency`, `effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
