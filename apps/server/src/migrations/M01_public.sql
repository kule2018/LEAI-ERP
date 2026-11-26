-- M01 公共能力迁移：审计、字典、编码、通知、文件、打印、AI

CREATE TABLE IF NOT EXISTS `sys_audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL,
  `biz_id` BIGINT NOT NULL DEFAULT 0,
  `action_name` VARCHAR(64) NOT NULL,
  `before_value` TEXT NULL,
  `after_value` TEXT NULL,
  `operator` BIGINT NOT NULL,
  `operator_name` VARCHAR(64) NOT NULL DEFAULT '',
  `ip` VARCHAR(64) NULL,
  `trace_id` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sys_audit_tenant_biz` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_dict` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `dict_type` VARCHAR(50) NOT NULL,
  `dict_name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_dict_type` (`tenant_id`, `dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_dict_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `dict_type` VARCHAR(50) NOT NULL,
  `item_code` VARCHAR(50) NOT NULL,
  `item_label` VARCHAR(100) NOT NULL,
  `item_value` VARCHAR(200) NULL,
  `sort_no` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_dict_item` (`tenant_id`, `dict_type`, `item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_sequence` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `biz_code` VARCHAR(50) NOT NULL,
  `biz_name` VARCHAR(100) NOT NULL DEFAULT '',
  `number_prefix` VARCHAR(20) NOT NULL,
  `date_format` VARCHAR(20) NOT NULL DEFAULT 'yyyyMMdd',
  `step_value` INT NOT NULL DEFAULT 1,
  `current_seq` BIGINT NOT NULL DEFAULT 0,
  `reset_cycle` VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  `doc_no` VARCHAR(80) NOT NULL DEFAULT '',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_sequence_biz` (`tenant_id`, `biz_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_notify` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `notify_no` VARCHAR(60) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `content` VARCHAR(1000) NULL,
  `channel` VARCHAR(24) NOT NULL,
  `receiver_id` BIGINT NOT NULL,
  `read_flag` VARCHAR(16) NOT NULL DEFAULT 'NO',
  `biz_type` VARCHAR(64) NULL,
  `biz_id` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sys_notify_receiver_read` (`tenant_id`, `receiver_id`, `read_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_file` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `object_key` VARCHAR(300) NOT NULL,
  `mime_type` VARCHAR(100) NULL,
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `storage_driver` VARCHAR(32) NOT NULL DEFAULT 'LOCAL',
  `url` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sys_file_tenant_deleted` (`tenant_id`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `print_template` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL,
  `paper` VARCHAR(32) NOT NULL DEFAULT 'A4',
  `schema` JSON NULL,
  `version` INT NOT NULL DEFAULT 1,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_print_template_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `print_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL,
  `biz_id` BIGINT NOT NULL,
  `biz_no` VARCHAR(64) NULL,
  `template_id` BIGINT NOT NULL,
  `template_code` VARCHAR(64) NOT NULL,
  `copies` INT NOT NULL DEFAULT 1,
  `channel` VARCHAR(32) NOT NULL,
  `printed_by` BIGINT NOT NULL,
  `printed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pdf_url` VARCHAR(500) NULL,
  `watermark` VARCHAR(200) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_print_record_biz` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_prompt` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `content` TEXT NOT NULL,
  `model` VARCHAR(64) NULL,
  `temperature` DECIMAL(3,2) NOT NULL DEFAULT 0.20,
  `version` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_prompt_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `capability` VARCHAR(64) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `model` VARCHAR(64) NOT NULL DEFAULT 'local-rule-engine',
  `prompt_tokens` INT NOT NULL DEFAULT 0,
  `completion_tokens` INT NOT NULL DEFAULT 0,
  `latency_ms` INT NOT NULL DEFAULT 0,
  `accepted` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `request` TEXT NULL,
  `response` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_ai_audit_tenant_capability` (`tenant_id`, `capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_conversation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_ai_conversation_user` (`tenant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_message` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `conversation_id` BIGINT NOT NULL,
  `role` VARCHAR(16) NOT NULL,
  `content` TEXT NOT NULL,
  `tool_calls` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_ai_message_conversation` (`tenant_id`, `conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_data_scope` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `scope_code` VARCHAR(50) NOT NULL,
  `scope_name` VARCHAR(100) NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL DEFAULT 'ALL',
  `org_field` VARCHAR(64) NOT NULL DEFAULT 'dept_id',
  `scope_level` VARCHAR(24) NOT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ENABLED',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_data_scope_code` (`tenant_id`, `scope_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
