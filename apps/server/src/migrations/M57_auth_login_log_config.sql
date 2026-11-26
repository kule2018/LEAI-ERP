-- 登录日志台账、租户级系统参数表、用户密码策略字段

CREATE TABLE IF NOT EXISTS `sys_login_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL DEFAULT 0,
  `user_id` BIGINT NULL,
  `username` VARCHAR(64) NOT NULL,
  `login_ip` VARCHAR(64) NULL,
  `login_result` VARCHAR(24) NOT NULL DEFAULT 'FAIL' COMMENT 'SUCCESS/FAIL/LOCKED',
  `fail_reason` VARCHAR(255) NULL,
  `user_agent` VARCHAR(500) NULL,
  `login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sys_login_log_tenant_at` (`tenant_id`, `login_at`),
  KEY `idx_sys_login_log_user` (`tenant_id`, `user_id`),
  KEY `idx_sys_login_log_result` (`tenant_id`, `login_result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL DEFAULT 0,
  `config_key` VARCHAR(100) NOT NULL,
  `config_value` TEXT NULL,
  `value_type` VARCHAR(24) NOT NULL DEFAULT 'STRING' COMMENT 'STRING/NUMBER/BOOLEAN/JSON',
  `category` VARCHAR(60) NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '系统内置参数不可删除',
  `remark` VARCHAR(500) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_config_key` (`tenant_id`, `config_key`),
  KEY `idx_sys_config_tenant_deleted` (`tenant_id`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `sys_user` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否强制修改密码';
ALTER TABLE `sys_user` ADD COLUMN `password_updated_at` DATETIME(3) NULL COMMENT '密码最后修改时间';
