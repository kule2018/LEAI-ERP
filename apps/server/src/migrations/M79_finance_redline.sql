-- 财务单据红冲与凭证作废：补齐状态与追溯字段
ALTER TABLE `fin_receipt`
  ADD COLUMN `status` varchar(24) NOT NULL DEFAULT 'POSTED' AFTER `received_at`,
  ADD COLUMN `reverse_of_id` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `reversed_at` datetime DEFAULT NULL AFTER `reverse_of_id`,
  ADD COLUMN `remark` varchar(300) DEFAULT NULL AFTER `reversed_at`;

ALTER TABLE `fin_payment`
  ADD COLUMN `status` varchar(24) NOT NULL DEFAULT 'POSTED' AFTER `paid_at`,
  ADD COLUMN `reverse_of_id` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `reversed_at` datetime DEFAULT NULL AFTER `reverse_of_id`,
  ADD COLUMN `remark` varchar(300) DEFAULT NULL AFTER `reversed_at`;

ALTER TABLE `receivable`
  ADD COLUMN `reverse_of_id` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `reversed_at` datetime DEFAULT NULL AFTER `reverse_of_id`,
  ADD COLUMN `remark` varchar(300) DEFAULT NULL AFTER `reversed_at`;

ALTER TABLE `payable`
  ADD COLUMN `reverse_of_id` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `reversed_at` datetime DEFAULT NULL AFTER `reverse_of_id`,
  ADD COLUMN `remark` varchar(300) DEFAULT NULL AFTER `reversed_at`;

ALTER TABLE `voucher`
  ADD COLUMN `voided_at` datetime DEFAULT NULL AFTER `posted_at`,
  ADD COLUMN `void_reason` varchar(200) DEFAULT NULL AFTER `voided_at`;

CREATE INDEX `idx_fin_receipt_status` ON `fin_receipt` (`tenant_id`,`status`);
CREATE INDEX `idx_fin_payment_status` ON `fin_payment` (`tenant_id`,`status`);

-- 核销记录补记来源收/付款单 ID，红冲时据此精确释放核销
ALTER TABLE `fin_writeoff`
  ADD COLUMN `source_id` bigint DEFAULT NULL AFTER `writeoff_type`;

CREATE INDEX `idx_fin_writeoff_source` ON `fin_writeoff` (`tenant_id`,`writeoff_type`,`source_id`);
