-- 银企直连多渠道报文适配与对账差异处理
-- 跨账户流水号可能重复，唯一索引改为账户 + 外部流水号
ALTER TABLE `fin_bank_transaction` DROP INDEX `uk_bank_tx_external`;
ALTER TABLE `fin_bank_transaction` ADD UNIQUE KEY `uk_bank_tx_external` (`tenant_id`,`account_id`,`external_no`);
