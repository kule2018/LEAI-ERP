-- 客户对账单：支持红冲（核销留痕 + 红冲原因）

ALTER TABLE `customer_statement` ADD COLUMN `reversed_amount` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '已红冲金额';
ALTER TABLE `customer_statement` ADD COLUMN `reverse_reason` VARCHAR(300) NULL COMMENT '红冲原因';
ALTER TABLE `customer_statement` ADD COLUMN `reversed_at` DATETIME NULL COMMENT '红冲时间';
