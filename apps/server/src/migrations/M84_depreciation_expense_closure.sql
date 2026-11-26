-- 折旧规则化与费用报销闭环
ALTER TABLE `fin_asset`
  ADD COLUMN `depreciation_method` varchar(24) NOT NULL DEFAULT 'STRAIGHT_LINE' AFTER `useful_months`,
  ADD COLUMN `residual_rate` decimal(6,4) NOT NULL DEFAULT 0 AFTER `depreciation_method`,
  ADD COLUMN `expense_subject_id` bigint DEFAULT NULL AFTER `residual_rate`,
  ADD COLUMN `accumulated_subject_id` bigint DEFAULT NULL AFTER `expense_subject_id`;

ALTER TABLE `fin_asset_depreciation`
  ADD COLUMN `voucher_id` bigint DEFAULT NULL AFTER `amount`,
  ADD COLUMN `method` varchar(24) NOT NULL DEFAULT 'STRAIGHT_LINE' AFTER `voucher_id`;

ALTER TABLE `fin_expense_claim`
  ADD COLUMN `approved_by` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `approved_at` datetime DEFAULT NULL AFTER `approved_by`,
  ADD COLUMN `approve_remark` varchar(500) DEFAULT NULL AFTER `approved_at`,
  ADD COLUMN `payment_id` bigint DEFAULT NULL AFTER `approve_remark`;

CREATE TABLE IF NOT EXISTS `fin_expense_claim_alloc` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `claim_id` bigint NOT NULL,
  `dept_id` bigint NOT NULL,
  `ratio` decimal(6,4) NOT NULL,
  `amount` decimal(18,4) NOT NULL,
  `subject_id` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_claim_alloc` (`tenant_id`,`claim_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
