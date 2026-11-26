-- M27 资金流水去重、工艺版本生效区间

CREATE TABLE IF NOT EXISTS `fin_bank_transaction` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `account_id` BIGINT NOT NULL,
  `external_no` VARCHAR(100) NOT NULL,
  `direction` VARCHAR(24) NOT NULL DEFAULT 'IN',
  `amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `tx_date` DATE NULL,
  `summary` VARCHAR(300) NULL,
  `matched` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bank_tx_external` (`tenant_id`, `external_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `mes_routing`
  ADD COLUMN `effective_from` DATE NULL COMMENT '生效起日' AFTER `version`,
  ADD COLUMN `effective_to` DATE NULL COMMENT '生效止日' AFTER `effective_from`;
