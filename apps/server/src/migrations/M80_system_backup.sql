-- 备份策略与恢复：备份策略、执行记录、恢复台账
CREATE TABLE IF NOT EXISTS `sys_backup_policy` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `policy_code` varchar(60) NOT NULL,
  `policy_name` varchar(120) NOT NULL,
  `backup_type` varchar(16) NOT NULL DEFAULT 'FULL',
  `interval_minutes` int NOT NULL DEFAULT 1440,
  `retention_days` int NOT NULL DEFAULT 30,
  `storage_path` varchar(300) NOT NULL,
  `remote_path` varchar(300) DEFAULT NULL,
  `remote_enabled` tinyint NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
  `last_run_at` datetime DEFAULT NULL,
  `last_result` varchar(300) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_sys_backup_policy` (`tenant_id`,`policy_code`),
  KEY `idx_sys_backup_policy_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_backup_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `backup_no` varchar(60) NOT NULL,
  `policy_id` bigint DEFAULT NULL,
  `policy_code` varchar(60) NOT NULL DEFAULT '',
  `backup_type` varchar(16) NOT NULL DEFAULT 'FULL',
  `status` varchar(16) NOT NULL DEFAULT 'RUNNING',
  `file_name` varchar(200) NOT NULL DEFAULT '',
  `file_path` varchar(400) DEFAULT NULL,
  `file_size` bigint NOT NULL DEFAULT 0,
  `duration_ms` int NOT NULL DEFAULT 0,
  `error_message` varchar(500) DEFAULT NULL,
  `is_offsite` tinyint NOT NULL DEFAULT 0,
  `operator_id` bigint DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sys_backup_record` (`tenant_id`,`status`),
  KEY `idx_sys_backup_record_no` (`tenant_id`,`backup_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_restore_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `restore_no` varchar(60) NOT NULL,
  `backup_id` bigint NOT NULL,
  `backup_no` varchar(60) NOT NULL DEFAULT '',
  `restore_mode` varchar(16) NOT NULL DEFAULT 'DRY_RUN',
  `target_env` varchar(60) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING',
  `result_message` varchar(500) DEFAULT NULL,
  `operator_note` varchar(300) DEFAULT NULL,
  `operator_id` bigint DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sys_restore_record` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;