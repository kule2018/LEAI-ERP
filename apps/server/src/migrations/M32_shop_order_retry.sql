-- M32 商城订单同步失败重试

ALTER TABLE `shop_order`
  ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0 COMMENT '同步重试次数' AFTER `synced_at`,
  ADD COLUMN `error_text` VARCHAR(500) NULL COMMENT '最近同步错误' AFTER `retry_count`;
