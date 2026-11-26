-- M94 通用单据版本快照：各业务域统一留存单据版本与版本差异
CREATE TABLE IF NOT EXISTS `revision_snapshot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `entity_code` varchar(64) NOT NULL,
  `biz_id` bigint NOT NULL,
  `version_no` int NOT NULL DEFAULT 1,
  `action` varchar(32) NOT NULL DEFAULT 'SNAPSHOT',
  `snapshot` json NOT NULL,
  `diff` json NULL,
  `operator_id` bigint NOT NULL DEFAULT 0,
  `operator_name` varchar(64) NULL,
  `source` varchar(32) NOT NULL DEFAULT 'SYSTEM',
  `remark` varchar(255) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_revision_target` (`tenant_id`, `entity_code`, `biz_id`, `version_no`),
  KEY `idx_revision_created` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
