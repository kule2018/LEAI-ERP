-- M06 生产制造迁移：BOM、工艺、MRP、排产、工单、报工、质检、设备、异常

CREATE TABLE IF NOT EXISTS `bom` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL,
  `version` VARCHAR(20) NOT NULL, `base_qty` DECIMAL(18,3) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0, `remark` VARCHAR(500) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_bom_product_version` (`tenant_id`, `product_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bom_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `bom_id` BIGINT NOT NULL,
  `material_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL, `loss_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `substitute_material_id` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_bom_item` (`tenant_id`, `bom_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_center` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `center_code` VARCHAR(50) NOT NULL,
  `center_name` VARCHAR(100) NOT NULL, `capacity` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_work_center_code` (`tenant_id`, `center_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_routing` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `product_id` BIGINT NOT NULL,
  `version` VARCHAR(20) NOT NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_mes_routing` (`tenant_id`, `product_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_operation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `routing_id` BIGINT NOT NULL,
  `operation_name` VARCHAR(100) NOT NULL, `work_center_id` BIGINT NULL,
  `standard_minutes` DECIMAL(10,2) NOT NULL DEFAULT 0, `sort_no` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_mes_operation` (`tenant_id`, `routing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_mrp_run` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `run_no` VARCHAR(60) NOT NULL,
  `plan_date` DATE NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'DONE', `params` JSON NULL,
  `created_by` BIGINT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_mrp_run` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_mrp_suggest` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `run_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `demand_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `available_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `onway_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `allocated_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `net_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `suggest_type` VARCHAR(24) NOT NULL DEFAULT 'PURCHASE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_mrp_suggest` (`tenant_id`, `run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_plan_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `task_name` VARCHAR(150) NOT NULL,
  `work_order_id` BIGINT NULL, `work_center_id` BIGINT NULL,
  `start_at` DATETIME(3) NOT NULL, `end_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PLANNED', `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_mes_plan_task` (`tenant_id`, `start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `order_no` VARCHAR(60) NOT NULL,
  `product_id` BIGINT NOT NULL, `bom_id` BIGINT NULL, `routing_id` BIGINT NULL, `warehouse_id` BIGINT NOT NULL,
  `qty` DECIMAL(18,3) NOT NULL, `produced_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `actual_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `plan_start` DATETIME(3) NULL, `plan_end` DATETIME(3) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT', `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_work_order_no` (`tenant_id`, `order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_order_issue` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `work_order_id` BIGINT NOT NULL,
  `issue_type` VARCHAR(16) NOT NULL, `material_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL,
  `batch_no` VARCHAR(60) NULL, `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_work_order_issue` (`tenant_id`, `work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_order_report` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `work_order_id` BIGINT NOT NULL,
  `operation_id` BIGINT NULL, `qty` DECIMAL(18,3) NOT NULL, `defect_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `user_id` BIGINT NOT NULL, `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_work_order_report` (`tenant_id`, `work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `work_order_complete` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `work_order_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL, `warehouse_id` BIGINT NOT NULL, `qty` DECIMAL(18,3) NOT NULL,
  `qc_result` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_work_order_complete` (`tenant_id`, `work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_qc` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `biz_type` VARCHAR(32) NOT NULL,
  `biz_id` BIGINT NOT NULL, `inspection_type` VARCHAR(32) NOT NULL,
  `sample_qty` DECIMAL(18,3) NOT NULL DEFAULT 0, `defect_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `result` VARCHAR(24) NOT NULL, `inspector_id` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_mes_qc` (`tenant_id`, `biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_equipment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `equipment_code` VARCHAR(50) NOT NULL,
  `equipment_name` VARCHAR(100) NOT NULL, `work_center_id` BIGINT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'IDLE', `oee` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `last_maintenance` DATE NULL, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_mes_equipment_code` (`tenant_id`, `equipment_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `production_exception` (
  `id` BIGINT NOT NULL AUTO_INCREMENT, `tenant_id` BIGINT NOT NULL, `exception_no` VARCHAR(60) NOT NULL,
  `exception_type` VARCHAR(32) NOT NULL, `work_order_id` BIGINT NULL, `reason` VARCHAR(500) NULL,
  `closed_note` VARCHAR(500) NULL, `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `created_by` BIGINT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), KEY `idx_production_exception` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
