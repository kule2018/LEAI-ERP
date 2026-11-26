-- 客户联系人：敏感字段加密存储（明文列仅保存掩码，原文入密文列）

ALTER TABLE `customer_contact` ADD COLUMN `phone_encrypted` VARCHAR(255) NULL COMMENT '联系电话密文' AFTER `phone`;
ALTER TABLE `customer_contact` ADD COLUMN `phone_mask` VARCHAR(60) NULL COMMENT '联系电话掩码' AFTER `phone_encrypted`;
ALTER TABLE `customer_contact` ADD COLUMN `email_encrypted` VARCHAR(255) NULL COMMENT '邮箱密文' AFTER `email`;
ALTER TABLE `customer_contact` ADD COLUMN `email_mask` VARCHAR(120) NULL COMMENT '邮箱掩码' AFTER `email_encrypted`;
