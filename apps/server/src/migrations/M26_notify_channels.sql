-- M26 通知模板与多渠道发送

CREATE TABLE IF NOT EXISTS `sys_notify_template` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` VARCHAR(1000) NOT NULL,
  `channels` VARCHAR(200) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notify_template_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `sys_notify`
  ADD COLUMN `send_status` VARCHAR(24) NOT NULL DEFAULT 'SUCCESS' COMMENT '发送状态' AFTER `biz_id`,
  ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0 COMMENT '重试次数' AFTER `send_status`,
  ADD COLUMN `last_error` VARCHAR(1000) NULL COMMENT '最近发送错误' AFTER `retry_count`;
