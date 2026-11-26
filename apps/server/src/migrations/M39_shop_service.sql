-- M39 商城服务：物流轨迹事件与客服质检记录

CREATE TABLE IF NOT EXISTS `shop_tracking_event` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `waybill_id` BIGINT NOT NULL,
  `event_no` VARCHAR(80) NULL,
  `carrier_status` VARCHAR(40) NOT NULL,
  `location` VARCHAR(200) NULL,
  `description` VARCHAR(500) NULL,
  `event_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shop_tracking` (`tenant_id`, `waybill_id`, `event_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_cs_quality_review` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `conversation_id` BIGINT NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `result` VARCHAR(24) NOT NULL,
  `review_note` VARCHAR(500) NULL,
  `reviewed_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shop_cs_qc` (`tenant_id`, `store_id`, `result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
