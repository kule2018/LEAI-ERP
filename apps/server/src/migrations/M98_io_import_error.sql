-- M98 导入导出任务与错误行明细
-- 说明：导出任务沿用既有 io_job 表（异步导出由调度器 worker 消费），
-- 这里补充导入错误行明细表，使错误行可追溯、可下载、可只导入正确行。
CREATE TABLE IF NOT EXISTS `io_import_error` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `code` varchar(50) NOT NULL,
  `batch_no` varchar(64) NOT NULL,
  `row_no` int NOT NULL,
  `field_name` varchar(120) NULL,
  `message` varchar(500) NOT NULL,
  `row_data` json NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_io_import_error` (`tenant_id`, `code`, `batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 导入批次记录：以任务形式登记每次导入，便于查询批次状态与错误报告
CREATE TABLE IF NOT EXISTS `io_import_task` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `code` varchar(50) NOT NULL,
  `batch_no` varchar(64) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'RUNNING',
  `total_rows` int NOT NULL DEFAULT 0,
  `imported_rows` int NOT NULL DEFAULT 0,
  `skipped_rows` int NOT NULL DEFAULT 0,
  `error_rows` int NOT NULL DEFAULT 0,
  `mode` varchar(24) NOT NULL DEFAULT 'STRICT',
  `error_message` varchar(1000) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` datetime NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_io_import_task_batch` (`tenant_id`, `batch_no`),
  KEY `idx_io_import_task_code` (`tenant_id`, `code`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
