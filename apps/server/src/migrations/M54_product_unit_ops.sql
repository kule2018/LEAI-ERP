-- 产品多单位换算、产品属性与默认仓库/库位、AI Prompt 版本历史
ALTER TABLE `product` ADD COLUMN `attributes` json NULL COMMENT '产品属性(JSON)' AFTER `tracking_type`;
ALTER TABLE `product` ADD COLUMN `default_warehouse_id` bigint NULL COMMENT '默认仓库' AFTER `attributes`;
ALTER TABLE `product` ADD COLUMN `default_location_id` bigint NULL COMMENT '默认库位' AFTER `default_warehouse_id`;

CREATE TABLE IF NOT EXISTS `md_product_unit_conversion` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `unit_id` bigint NOT NULL,
  `conversion_rate` decimal(18,6) NOT NULL DEFAULT 1 COMMENT '换算率(1个该单位折合基准单位数)',
  `is_base` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否基准单位',
  `remark` varchar(255) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_puc_product_unit` (`tenant_id`,`product_id`,`unit_id`),
  KEY `idx_md_puc_product` (`tenant_id`,`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品多单位换算';

ALTER TABLE `ai_prompt` ADD COLUMN `status` varchar(24) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态' AFTER `version`;
ALTER TABLE `ai_prompt` ADD COLUMN `parent_id` bigint NULL COMMENT '上一版本ID' AFTER `status`;
ALTER TABLE `ai_prompt` ADD COLUMN `published_at` datetime NULL COMMENT '发布时间' AFTER `parent_id`;
ALTER TABLE `ai_prompt` DROP INDEX `uk_ai_prompt_code`;
ALTER TABLE `ai_prompt` ADD UNIQUE KEY `uk_ai_prompt_code_version` (`tenant_id`,`code`,`version`);
