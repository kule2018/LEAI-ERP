-- M47 生产制造域扩展：BOM 变更审批、工单变更、检验项、设备故障与保养、排产锁定、超额领料审批

CREATE TABLE IF NOT EXISTS `mes_bom_change` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `bom_id` BIGINT NOT NULL,
  `from_version` VARCHAR(20) NULL,
  `to_version` VARCHAR(20) NOT NULL,
  `change_type` VARCHAR(24) NOT NULL DEFAULT 'UPDATE',
  `diff` JSON NULL,
  `change_reason` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `submitted_by` BIGINT NOT NULL,
  `approved_by` BIGINT NULL,
  `approved_at` DATETIME(3) NULL,
  `approve_comment` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_bom_change` (`tenant_id`, `bom_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_work_order_change` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `work_order_id` BIGINT NOT NULL,
  `change_version` INT NOT NULL DEFAULT 1,
  `change_type` VARCHAR(24) NOT NULL,
  `before_value` JSON NULL,
  `after_value` JSON NULL,
  `change_reason` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_by` BIGINT NOT NULL,
  `approved_by` BIGINT NULL,
  `approved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_work_order_change` (`tenant_id`, `work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_qc_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `qc_id` BIGINT NOT NULL,
  `item_code` VARCHAR(50) NOT NULL,
  `item_name` VARCHAR(100) NOT NULL,
  `standard_value` DECIMAL(18,4) NULL,
  `measured_value` DECIMAL(18,4) NULL,
  `upper_limit` DECIMAL(18,4) NULL,
  `lower_limit` DECIMAL(18,4) NULL,
  `is_qualified` TINYINT(1) NOT NULL DEFAULT 0,
  `item_result` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_qc_item` (`tenant_id`, `qc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_equipment_fault` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `equipment_id` BIGINT NOT NULL,
  `fault_no` VARCHAR(60) NOT NULL,
  `fault_type` VARCHAR(32) NOT NULL DEFAULT 'MECHANICAL',
  `fault_desc` VARCHAR(500) NULL,
  `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `repaired_at` DATETIME(3) NULL,
  `downtime_minutes` INT NOT NULL DEFAULT 0,
  `stop_line_at` DATETIME(3) NULL,
  `stop_line_end` DATETIME(3) NULL,
  `delay_days` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `work_order_id` BIGINT NULL,
  `repair_result` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `reported_by` BIGINT NOT NULL,
  `repaired_by` BIGINT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mes_equipment_fault` (`tenant_id`, `equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_equipment_maintenance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `equipment_id` BIGINT NOT NULL,
  `maintenance_no` VARCHAR(60) NOT NULL,
  `plan_date` DATE NULL,
  `cycle_days` INT NOT NULL DEFAULT 30,
  `maintenance_type` VARCHAR(32) NOT NULL DEFAULT 'ROUTINE',
  `maintenance_content` VARCHAR(500) NULL,
  `executed_at` DATETIME(3) NULL,
  `executor_id` BIGINT NULL,
  `execute_result` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_equipment_maintenance` (`tenant_id`, `equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_plan_task_lock` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `plan_task_id` BIGINT NOT NULL,
  `locked_by` BIGINT NOT NULL,
  `locked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `unlocked_at` DATETIME(3) NULL,
  `unlocked_by` BIGINT NULL,
  `lock_reason` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'LOCKED',
  PRIMARY KEY (`id`),
  KEY `idx_mes_plan_task_lock` (`tenant_id`, `plan_task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mes_over_issue_approval` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `work_order_id` BIGINT NOT NULL,
  `material_id` BIGINT NOT NULL,
  `required_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `issued_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `over_qty` DECIMAL(18,3) NOT NULL DEFAULT 0,
  `request_reason` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `requested_by` BIGINT NOT NULL,
  `approved_by` BIGINT NULL,
  `approved_at` DATETIME(3) NULL,
  `approve_comment` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mes_over_issue_approval` (`tenant_id`, `work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 既有表字段扩展
ALTER TABLE `mes_routing`
  ADD COLUMN `bom_id` BIGINT NULL DEFAULT NULL AFTER `product_id`;

ALTER TABLE `work_center`
  ADD COLUMN `center_type` VARCHAR(24) NOT NULL DEFAULT 'PRODUCTION_LINE' AFTER `center_name`,
  ADD COLUMN `standard_capacity` DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER `capacity`,
  ADD COLUMN `shift_hours` DECIMAL(10,2) NOT NULL DEFAULT 8 AFTER `standard_capacity`;

ALTER TABLE `mes_mrp_suggest`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 0 AFTER `suggest_type`,
  ADD COLUMN `priority_label` VARCHAR(12) NOT NULL DEFAULT 'LOW' AFTER `priority`,
  ADD COLUMN `priority_reason` VARCHAR(500) NULL AFTER `priority_label`;

ALTER TABLE `mes_plan_task`
  ADD COLUMN `locked` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `locked_at` DATETIME(3) NULL AFTER `locked`,
  ADD COLUMN `locked_by` BIGINT NULL AFTER `locked_at`;

ALTER TABLE `work_order`
  ADD COLUMN `parent_work_order_id` BIGINT NULL DEFAULT NULL AFTER `routing_id`,
  ADD COLUMN `change_version` INT NOT NULL DEFAULT 0 AFTER `parent_work_order_id`,
  ADD COLUMN `remark` VARCHAR(500) NULL DEFAULT NULL AFTER `change_version`;

ALTER TABLE `work_order_issue`
  ADD COLUMN `scan_code` VARCHAR(120) NULL DEFAULT NULL AFTER `batch_no`,
  ADD COLUMN `over_approved` TINYINT(1) NOT NULL DEFAULT 0 AFTER `scan_code`;

ALTER TABLE `work_order_report`
  ADD COLUMN `work_hours` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `defect_qty`,
  ADD COLUMN `scan_code` VARCHAR(120) NULL DEFAULT NULL AFTER `work_hours`;

ALTER TABLE `production_exception`
  ADD COLUMN `stop_line_at` DATETIME(3) NULL DEFAULT NULL AFTER `closed_note`,
  ADD COLUMN `stop_line_end` DATETIME(3) NULL DEFAULT NULL AFTER `stop_line_at`,
  ADD COLUMN `downtime_minutes` INT NOT NULL DEFAULT 0 AFTER `stop_line_end`,
  ADD COLUMN `delay_days` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `downtime_minutes`,
  ADD COLUMN `impact_order_id` BIGINT NULL DEFAULT NULL AFTER `delay_days`;

ALTER TABLE `mes_equipment`
  ADD COLUMN `fault_status` VARCHAR(24) NOT NULL DEFAULT 'NORMAL' AFTER `oee`,
  ADD COLUMN `maintenance_cycle_days` INT NOT NULL DEFAULT 30 AFTER `fault_status`;
