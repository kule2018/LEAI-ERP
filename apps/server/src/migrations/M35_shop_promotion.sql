-- M35 商城促销：优惠券、秒杀、独立活动库存与超卖控制

CREATE TABLE IF NOT EXISTS `shop_coupon` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `coupon_code` VARCHAR(60) NOT NULL,
  `coupon_type` VARCHAR(16) NOT NULL,
  `discount_value` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `min_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `max_discount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `start_time` DATETIME(3) NOT NULL,
  `end_time` DATETIME(3) NOT NULL,
  `stackable` TINYINT(1) NOT NULL DEFAULT 0,
  `used_count` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_coupon_code` (`tenant_id`, `store_id`, `coupon_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_seckill` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `seckill_code` VARCHAR(60) NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0,
  `base_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `seckill_price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `limit_per_user` INT NOT NULL DEFAULT 1,
  `start_time` DATETIME(3) NOT NULL,
  `end_time` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_seckill_code` (`tenant_id`, `store_id`, `seckill_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_activity_stock` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `activity_type` VARCHAR(24) NOT NULL,
  `activity_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0,
  `total_stock` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `sold_stock` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `locked_stock` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_activity_stock` (`tenant_id`, `store_id`, `activity_type`, `activity_id`, `product_id`, `variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shop_activity_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `store_id` BIGINT NOT NULL,
  `shop_order_id` BIGINT NULL,
  `activity_type` VARCHAR(24) NOT NULL,
  `activity_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` BIGINT NOT NULL DEFAULT 0,
  `qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `buyer_key` VARCHAR(100) NOT NULL DEFAULT 'ANONYMOUS',
  `coupon_code` VARCHAR(60) NULL,
  `discount_amount` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'LOCKED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shop_activity_order` (`tenant_id`, `store_id`, `activity_id`, `status`),
  KEY `idx_shop_activity_order_buyer` (`tenant_id`, `activity_type`, `activity_id`, `product_id`, `variant_id`, `buyer_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
