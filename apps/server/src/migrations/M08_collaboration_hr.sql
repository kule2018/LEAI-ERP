-- M08 协同办公与人事行政迁移

CREATE TABLE IF NOT EXISTS `flow_definition` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `code` VARCHAR(64) NOT NULL,
  `flow_name` VARCHAR(100) NOT NULL, `biz_type` VARCHAR(64) NOT NULL, `schema` JSON NULL,
  `version` INT NOT NULL DEFAULT 1, `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_flow_definition_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `flow_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `definition_id` BIGINT NOT NULL,
  `node_code` VARCHAR(60) NOT NULL, `node_name` VARCHAR(100) NOT NULL,
  `node_type` VARCHAR(24) NOT NULL DEFAULT 'APPROVAL', `assignee_rule` VARCHAR(100) NULL,
  `condition_expr` VARCHAR(300) NULL, `sort_no` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_flow_node` (`tenant_id`, `definition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `flow_instance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `definition_id` BIGINT NOT NULL,
  `biz_type` VARCHAR(64) NOT NULL, `biz_id` BIGINT NOT NULL, `biz_no` VARCHAR(80) NULL,
  `started_by` BIGINT NOT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
  `current_node_id` BIGINT NULL, `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), KEY `idx_flow_instance` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `flow_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `instance_id` BIGINT NOT NULL,
  `node_id` BIGINT NOT NULL, `assignee_id` BIGINT NOT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `due_at` DATETIME(3) NULL, `acted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_flow_task_assignee` (`tenant_id`, `assignee_id`, `status`),
  KEY `idx_flow_task_instance` (`tenant_id`, `instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `flow_task_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `task_id` BIGINT NOT NULL,
  `action` VARCHAR(24) NOT NULL, `operator_id` BIGINT NOT NULL, `comment` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_flow_task_log` (`tenant_id`, `task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `oa_notice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `title` VARCHAR(200) NOT NULL,
  `content` TEXT NULL, `channel` VARCHAR(24) NOT NULL DEFAULT 'INMAIL',
  `published_flag` VARCHAR(16) NOT NULL DEFAULT 'NO', `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_oa_notice` (`tenant_id`, `published_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `oa_chat_message` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `channel` VARCHAR(80) NOT NULL,
  `sender_id` BIGINT NOT NULL, `receiver_id` BIGINT NULL, `content` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_oa_chat` (`tenant_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `oa_project` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `project_code` VARCHAR(60) NOT NULL,
  `project_name` VARCHAR(150) NOT NULL, `owner_id` BIGINT NULL, `start_date` DATE NULL, `end_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_oa_project` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `oa_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `project_id` BIGINT NULL,
  `task_name` VARCHAR(150) NOT NULL, `assignee_id` BIGINT NULL, `due_date` DATE NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'TODO', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_oa_task_project` (`tenant_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `oa_document` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `doc_code` VARCHAR(60) NOT NULL,
  `title` VARCHAR(150) NOT NULL, `category_id` BIGINT NULL, `version` INT NOT NULL DEFAULT 1,
  `file_url` VARCHAR(500) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_oa_document` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_recruit_demand` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `demand_no` VARCHAR(60) NOT NULL,
  `position_name` VARCHAR(100) NOT NULL, `headcount` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_recruit` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_candidate` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `demand_id` BIGINT NULL,
  `name` VARCHAR(64) NOT NULL, `mobile` VARCHAR(30) NULL, `stage` VARCHAR(24) NOT NULL DEFAULT 'APPLIED',
  `score` INT NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_candidate` (`tenant_id`, `stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_interview` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `candidate_id` BIGINT NOT NULL,
  `interviewer_id` BIGINT NOT NULL, `interview_at` DATETIME(3) NULL,
  `result` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `feedback` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_interview` (`tenant_id`, `candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_shift` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `shift_code` VARCHAR(50) NOT NULL,
  `shift_name` VARCHAR(100) NOT NULL, `start_time` VARCHAR(10) NOT NULL, `end_time` VARCHAR(10) NOT NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_hr_shift_code` (`tenant_id`, `shift_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_punch` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `employee_id` BIGINT NOT NULL,
  `punch_time` DATETIME(3) NOT NULL, `source` VARCHAR(24) NOT NULL DEFAULT 'DEVICE',
  `status` VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  PRIMARY KEY (`id`), KEY `idx_hr_punch` (`tenant_id`, `employee_id`, `punch_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_leave` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `employee_id` BIGINT NOT NULL,
  `leave_type` VARCHAR(32) NOT NULL, `start_time` DATETIME(3) NOT NULL, `end_time` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_leave` (`tenant_id`, `employee_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_overtime` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `employee_id` BIGINT NOT NULL,
  `hours` DECIMAL(10,2) NOT NULL, `reason` VARCHAR(300) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_overtime` (`tenant_id`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_salary` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `employee_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL, `gross_amount` DECIMAL(18,4) NOT NULL, `net_amount` DECIMAL(18,4) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_salary` (`tenant_id`, `period`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_performance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `employee_id` BIGINT NOT NULL,
  `period` VARCHAR(20) NOT NULL, `score` INT NOT NULL DEFAULT 0, `level` VARCHAR(12) NOT NULL DEFAULT 'C',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_performance` (`tenant_id`, `period`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_training` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `course_name` VARCHAR(150) NOT NULL,
  `plan_date` DATE NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_training` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_admin_asset` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `asset_no` VARCHAR(60) NOT NULL,
  `asset_name` VARCHAR(150) NOT NULL, `holder_id` BIGINT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'IDLE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_hr_admin_asset_no` (`tenant_id`, `asset_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_vehicle` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `plate_no` VARCHAR(30) NOT NULL,
  `vehicle_name` VARCHAR(100) NOT NULL, `driver_id` BIGINT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'IDLE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `uk_hr_vehicle_plate` (`tenant_id`, `plate_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hr_vehicle_use` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `vehicle_id` BIGINT NOT NULL,
  `apply_user_id` BIGINT NOT NULL, `start_time` DATETIME(3) NOT NULL, `end_time` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_hr_vehicle_use` (`tenant_id`, `vehicle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
