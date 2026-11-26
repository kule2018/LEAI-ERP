-- M90 供应商敏感字段加密存储：银行账号明文列仅保留掩码，密文单独存储
ALTER TABLE `supplier`
  ADD COLUMN `bank_account_encrypted` varchar(255) NULL COMMENT '银行账号密文' AFTER `bank_account`,
  ADD COLUMN `bank_account_mask` varchar(100) NULL COMMENT '银行账号掩码' AFTER `bank_account_encrypted`;

ALTER TABLE `supplier_bank_account`
  ADD COLUMN `account_no_encrypted` varchar(255) NULL COMMENT '账号密文' AFTER `account_no`,
  ADD COLUMN `account_no_mask` varchar(100) NULL COMMENT '账号掩码' AFTER `account_no_encrypted`;
