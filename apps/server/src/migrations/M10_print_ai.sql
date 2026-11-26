-- M10 打印中心扩展与 AI 场景迁移

CREATE TABLE IF NOT EXISTS `print_job` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `job_no` VARCHAR(60) NOT NULL, `biz_type` VARCHAR(64) NOT NULL, `biz_id` BIGINT NOT NULL,
  `template_id` BIGINT NOT NULL, `copies` INT NOT NULL DEFAULT 1,
  `channel` VARCHAR(32) NOT NULL DEFAULT 'SERVER_PDF', `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `record_id` BIGINT NULL, `error_text` VARCHAR(500) NULL,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `finished_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_print_job_no` (`tenant_id`, `job_no`),
  KEY `idx_print_job` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `print_label_template` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `label_code` VARCHAR(60) NOT NULL, `label_name` VARCHAR(100) NOT NULL,
  `barcode_type` VARCHAR(24) NOT NULL DEFAULT 'CODE128', `paper_size` VARCHAR(30) NOT NULL DEFAULT '50x30',
  `schema` JSON NULL, `version` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_print_label_code` (`tenant_id`, `label_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `task_no` VARCHAR(60) NOT NULL, `capability` VARCHAR(64) NOT NULL,
  `input_text` TEXT NULL, `input_json` JSON NULL, `result_json` JSON NULL,
  `confidence` DECIMAL(5,4) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'DONE',
  `audit_id` BIGINT NULL, `evidence_json` JSON NULL,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_ai_task_no` (`tenant_id`, `task_no`),
  KEY `idx_ai_task_capability` (`tenant_id`, `capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_model_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `code` VARCHAR(60) NOT NULL, `name` VARCHAR(100) NOT NULL,
  `provider` VARCHAR(40) NOT NULL, `model` VARCHAR(80) NOT NULL,
  `endpoint` VARCHAR(500) NULL, `api_key_mask` VARCHAR(100) NULL,
  `temperature` DECIMAL(3,2) NOT NULL DEFAULT 0.20, `max_tokens` INT NOT NULL DEFAULT 2048,
  `rate_limit` INT NOT NULL DEFAULT 60, `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0, `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_ai_model_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_knowledge_doc` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `doc_code` VARCHAR(60) NOT NULL, `title` VARCHAR(150) NOT NULL,
  `doc_type` VARCHAR(24) NOT NULL DEFAULT 'TEXT', `file_url` VARCHAR(500) NULL, `content` TEXT NULL,
  `visibility` VARCHAR(24) NOT NULL DEFAULT 'DEPT', `org_id` BIGINT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', `chunk_count` INT NOT NULL DEFAULT 0,
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_ai_knowledge_doc_code` (`tenant_id`, `doc_code`),
  KEY `idx_ai_knowledge_doc_scope` (`tenant_id`, `visibility`, `org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_knowledge_chunk` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL,
  `doc_id` BIGINT NOT NULL, `chunk_no` INT NOT NULL, `content` TEXT NOT NULL,
  `vector_status` VARCHAR(24) NOT NULL DEFAULT 'LOCAL',
  `feedback_good` INT NOT NULL DEFAULT 0, `feedback_bad` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_ai_knowledge_chunk` (`tenant_id`, `doc_id`, `chunk_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
