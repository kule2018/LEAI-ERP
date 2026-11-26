-- M93 自定义字段与自定义表单：业务单据动态扩展字段 + 动态表单布局
CREATE TABLE IF NOT EXISTS `custom_field` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `entity_code` varchar(64) NOT NULL,
  `field_key` varchar(64) NOT NULL,
  `field_label` varchar(128) NOT NULL,
  `field_type` varchar(24) NOT NULL DEFAULT 'TEXT',
  `options` json NULL,
  `default_value` varchar(500) NULL,
  `required` tinyint NOT NULL DEFAULT 0,
  `display_order` int NOT NULL DEFAULT 0,
  `group_name` varchar(64) NOT NULL DEFAULT '基础信息',
  `visible_in_list` tinyint NOT NULL DEFAULT 1,
  `allow_filter` tinyint NOT NULL DEFAULT 0,
  `max_length` int NULL,
  `min_value` decimal(18,4) NULL,
  `max_value` decimal(18,4) NULL,
  `pattern` varchar(255) NULL,
  `reference_type` varchar(64) NULL,
  `condition` json NULL,
  `status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
  `remark` varchar(255) NULL,
  `created_by` bigint NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_custom_field_entity` (`tenant_id`, `entity_code`, `is_deleted`),
  KEY `idx_custom_field_key` (`tenant_id`, `entity_code`, `field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `custom_form` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `form_code` varchar(64) NOT NULL,
  `form_name` varchar(128) NOT NULL,
  `entity_code` varchar(64) NOT NULL,
  `layout` json NULL,
  `version` int NOT NULL DEFAULT 1,
  `status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
  `remark` varchar(255) NULL,
  `created_by` bigint NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_custom_form_entity` (`tenant_id`, `entity_code`, `is_deleted`),
  KEY `idx_custom_form_code` (`tenant_id`, `form_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `custom_field_value` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `entity_code` varchar(64) NOT NULL,
  `biz_id` bigint NOT NULL,
  `field_key` varchar(64) NOT NULL,
  `field_value` text NULL,
  `updated_by` bigint NOT NULL DEFAULT 0,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_custom_value_target` (`tenant_id`, `entity_code`, `biz_id`),
  KEY `idx_custom_value_field` (`tenant_id`, `entity_code`, `field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
