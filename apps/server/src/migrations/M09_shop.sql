-- M09 商城渠道迁移

CREATE TABLE IF NOT EXISTS `shop_store` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `store_code` VARCHAR(60) NOT NULL, `store_name` VARCHAR(150) NOT NULL, `platform` VARCHAR(40) NOT NULL,
  `auth_config` JSON NULL, `secret_mask` VARCHAR(100) NULL,
  `health_status` VARCHAR(24) NOT NULL DEFAULT 'UNKNOWN', `sync_strategy` VARCHAR(24) NOT NULL DEFAULT 'MANUAL',
  `auth_expire_at` DATETIME(3) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_shop_store_code` (`tenant_id`, `store_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_goods_map` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `platform_goods_id` VARCHAR(100) NOT NULL, `platform_sku_id` VARCHAR(100) NULL,
  `product_id` BIGINT NOT NULL, `variant_id` BIGINT NOT NULL DEFAULT 0,
  `price_rule` VARCHAR(200) NULL, `stock_rule` VARCHAR(200) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_shop_goods_map` (`tenant_id`, `store_id`, `platform_goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `platform_order_no` VARCHAR(100) NOT NULL, `idempotent_key` VARCHAR(180) NOT NULL,
  `customer_id` BIGINT NULL, `sale_order_id` BIGINT NULL,
  `order_amount` DECIMAL(18,4) NOT NULL DEFAULT 0, `paid_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `ship_status` VARCHAR(24) NOT NULL DEFAULT 'UNSHIPPED', `status` VARCHAR(24) NOT NULL DEFAULT 'SYNCED',
  `payload` JSON NULL, `synced_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_shop_order_idempotent` (`tenant_id`, `idempotent_key`),
  KEY `idx_shop_order_store` (`tenant_id`, `store_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_sync_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `biz_type` VARCHAR(32) NOT NULL, `biz_id` BIGINT NOT NULL DEFAULT 0,
  `idempotent_key` VARCHAR(180) NULL, `result` VARCHAR(24) NOT NULL, `error_text` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_shop_sync_log` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_promotion` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `promotion_code` VARCHAR(60) NOT NULL, `promotion_type` VARCHAR(32) NOT NULL,
  `start_time` DATETIME(3) NOT NULL, `end_time` DATETIME(3) NOT NULL,
  `stock_limit` DECIMAL(18,3) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_shop_promotion` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_payment_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `channel` VARCHAR(40) NOT NULL, `merchant_id` VARCHAR(100) NULL, `secret_mask` VARCHAR(100) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_shop_payment_config` (`tenant_id`, `store_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_waybill` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `shop_order_id` BIGINT NOT NULL, `waybill_no` VARCHAR(80) NOT NULL, `carrier` VARCHAR(60) NULL,
  `label_url` VARCHAR(500) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `exception_flag` VARCHAR(16) NOT NULL DEFAULT 'NO', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_shop_waybill_no` (`tenant_id`, `waybill_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_cs_conversation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `store_id` BIGINT NOT NULL,
  `platform_buyer_id` VARCHAR(100) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `last_message` VARCHAR(500) NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), KEY `idx_shop_cs` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
