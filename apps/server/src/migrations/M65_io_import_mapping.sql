-- 导入字段映射：支持自定义上传文件列名与标准模板表头的映射

CREATE TABLE IF NOT EXISTS `io_import_mapping` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(50) NOT NULL COMMENT '导入资源代码',
  `source_header` VARCHAR(120) NOT NULL COMMENT '上传文件列名',
  `target_header` VARCHAR(120) NOT NULL COMMENT '标准模板表头',
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_io_import_mapping` (`tenant_id`, `code`, `source_header`)
) ENGINE = InnoDB COMMENT '导入字段映射';
