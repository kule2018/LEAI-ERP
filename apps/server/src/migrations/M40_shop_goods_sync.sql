-- M40 商城商品映射同步状态与失败重试

ALTER TABLE `shop_goods_map`
  ADD COLUMN `sync_status` VARCHAR(24) NOT NULL DEFAULT 'IDLE' AFTER `status`,
  ADD COLUMN `last_sync_at` DATETIME(3) NULL AFTER `sync_status`,
  ADD COLUMN `error_text` VARCHAR(500) NULL AFTER `last_sync_at`;
