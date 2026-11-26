-- 销售条款库：合同条款主数据，支持条款复用与续签继承

CREATE TABLE IF NOT EXISTS `sale_clause` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL DEFAULT 0,
  `clause_code` VARCHAR(60) NOT NULL,
  `clause_title` VARCHAR(150) NOT NULL,
  `clause_content` TEXT NULL,
  `category` VARCHAR(60) NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '内置条款不可删除',
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sale_clause_code` (`tenant_id`, `clause_code`),
  KEY `idx_sale_clause_tenant` (`tenant_id`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `sale_contract` ADD COLUMN `renewed_from_id` BIGINT NULL COMMENT '续签来源合同';
ALTER TABLE `sale_contract` ADD COLUMN `renew_count` INT NOT NULL DEFAULT 0 COMMENT '续签次数';
ALTER TABLE `sale_contract` ADD COLUMN `signed_at` DATETIME(3) NULL COMMENT '电子签署时间';
