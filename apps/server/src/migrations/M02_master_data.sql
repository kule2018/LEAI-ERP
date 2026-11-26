-- M02 主数据迁移：客户、供应商、产品/SKU、仓库库位、员工

CREATE TABLE IF NOT EXISTS `customer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_code` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_group` VARCHAR(50) NULL,
  `level_id` BIGINT NULL,
  `credit_limit` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `credit_used` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `price_level_id` BIGINT NULL,
  `owner_user_id` BIGINT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_code` (`tenant_id`, `customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_contact` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(100) NULL,
  `position` VARCHAR(50) NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_customer_contact_customer` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_address` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NOT NULL,
  `province` VARCHAR(32) NULL,
  `city` VARCHAR(32) NULL,
  `district` VARCHAR(32) NULL,
  `address` VARCHAR(300) NOT NULL,
  `contact_name` VARCHAR(50) NULL,
  `contact_phone` VARCHAR(30) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_customer_address_customer` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `supplier` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_code` VARCHAR(50) NOT NULL,
  `supplier_name` VARCHAR(150) NOT NULL,
  `supplier_group` VARCHAR(50) NULL,
  `qualification_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `qualification_expire` DATE NULL,
  `blacklist` TINYINT(1) NOT NULL DEFAULT 0,
  `rating_score` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `contact_name` VARCHAR(50) NULL,
  `contact_phone` VARCHAR(30) NULL,
  `bank_account` VARCHAR(100) NULL,
  `bank_name` VARCHAR(100) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_supplier_code` (`tenant_id`, `supplier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_category` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `category_code` VARCHAR(50) NOT NULL,
  `category_name` VARCHAR(100) NOT NULL,
  `parent_id` BIGINT NULL,
  `sort_no` INT NOT NULL DEFAULT 0,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_category_code` (`tenant_id`, `category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_brand` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `brand_code` VARCHAR(50) NOT NULL,
  `brand_name` VARCHAR(100) NOT NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_brand_code` (`tenant_id`, `brand_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_unit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `unit_code` VARCHAR(20) NOT NULL,
  `unit_name` VARCHAR(50) NOT NULL,
  `precision` INT NOT NULL DEFAULT 3,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_unit_code` (`tenant_id`, `unit_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `product_code` VARCHAR(50) NOT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `barcode` VARCHAR(100) NULL,
  `category_id` BIGINT NULL,
  `brand_id` BIGINT NULL,
  `unit_id` BIGINT NULL,
  `product_type` VARCHAR(24) NOT NULL DEFAULT 'STANDARD',
  `tracking_type` VARCHAR(24) NOT NULL DEFAULT 'NONE',
  `cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `image_url` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_code` (`tenant_id`, `product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_variant` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `sku_code` VARCHAR(80) NOT NULL,
  `attributes` JSON NULL,
  `barcode` VARCHAR(100) NULL,
  `cost` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `price` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `image_url` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_variant_sku` (`tenant_id`, `sku_code`),
  KEY `idx_product_variant_product` (`tenant_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `warehouse` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `warehouse_code` VARCHAR(50) NOT NULL,
  `warehouse_name` VARCHAR(100) NOT NULL,
  `org_id` BIGINT NULL,
  `address` VARCHAR(300) NULL,
  `manager` VARCHAR(50) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_warehouse_code` (`tenant_id`, `warehouse_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `location` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `warehouse_id` BIGINT NOT NULL,
  `location_code` VARCHAR(50) NOT NULL,
  `location_name` VARCHAR(100) NULL,
  `zone_code` VARCHAR(50) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_location_code` (`tenant_id`, `warehouse_id`, `location_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `employee` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `employee_no` VARCHAR(50) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `dept_id` BIGINT NULL,
  `position_id` BIGINT NULL,
  `user_id` BIGINT NULL,
  `mobile` VARCHAR(30) NULL,
  `email` VARCHAR(100) NULL,
  `hire_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_employee_no` (`tenant_id`, `employee_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
