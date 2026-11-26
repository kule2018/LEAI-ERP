-- M99 审计字段级变更明细
-- 说明：审计主表 audit_log 仍保存整块前后快照，这里补充字段粒度明细，
-- 用于按单据查看「哪个字段由什么值改成什么值」，并支持按字段检索与导出。
CREATE TABLE IF NOT EXISTS `audit_field_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `biz_type` varchar(64) NOT NULL,
  `biz_id` bigint NOT NULL DEFAULT 0,
  `action` varchar(64) NOT NULL,
  `field_key` varchar(120) NOT NULL,
  `change_type` varchar(16) NOT NULL,
  `before_value` text NULL,
  `after_value` text NULL,
  `operator` bigint NULL,
  `operator_name` varchar(64) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_field_log` (`tenant_id`, `biz_type`, `biz_id`),
  KEY `idx_audit_field_log_field` (`tenant_id`, `field_key`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
