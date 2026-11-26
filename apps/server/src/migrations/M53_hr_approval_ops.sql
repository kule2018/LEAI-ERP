-- 人事审批与核算增强：员工排班、社保公积金明细、资产盘点与维修台账、绩效 KPI 指标库与校准会议
ALTER TABLE `hr_leave` ADD COLUMN `days` decimal(6,2) NOT NULL DEFAULT 0 COMMENT '请假天数' AFTER `end_time`;
ALTER TABLE `hr_leave` ADD COLUMN `approver_id` bigint NULL COMMENT '审批人' AFTER `status`;
ALTER TABLE `hr_leave` ADD COLUMN `approved_at` datetime NULL COMMENT '审批时间' AFTER `approver_id`;
ALTER TABLE `hr_leave` ADD COLUMN `approve_comment` varchar(300) NULL COMMENT '审批意见' AFTER `approved_at`;

ALTER TABLE `hr_overtime` ADD COLUMN `compensate_hours` decimal(6,2) NOT NULL DEFAULT 0 COMMENT '调休时长' AFTER `reason`;
ALTER TABLE `hr_overtime` ADD COLUMN `approver_id` bigint NULL COMMENT '审批人' AFTER `status`;
ALTER TABLE `hr_overtime` ADD COLUMN `approved_at` datetime NULL COMMENT '审批时间' AFTER `approver_id`;
ALTER TABLE `hr_overtime` ADD COLUMN `approve_comment` varchar(300) NULL COMMENT '审批意见' AFTER `approved_at`;

ALTER TABLE `hr_vehicle_use` ADD COLUMN `mileage` decimal(12,2) NOT NULL DEFAULT 0 COMMENT '行驶里程(公里)' AFTER `end_time`;
ALTER TABLE `hr_vehicle_use` ADD COLUMN `reason` varchar(300) NULL COMMENT '用车事由' AFTER `mileage`;
ALTER TABLE `hr_vehicle_use` ADD COLUMN `approver_id` bigint NULL COMMENT '审批人' AFTER `status`;
ALTER TABLE `hr_vehicle_use` ADD COLUMN `approved_at` datetime NULL COMMENT '审批时间' AFTER `approver_id`;
ALTER TABLE `hr_vehicle_use` ADD COLUMN `approve_comment` varchar(300) NULL COMMENT '审批意见' AFTER `approved_at`;

ALTER TABLE `hr_vehicle_expense` ADD COLUMN `fuel_litres` decimal(10,2) NOT NULL DEFAULT 0 COMMENT '加油升数' AFTER `expense_date`;
ALTER TABLE `hr_vehicle_expense` ADD COLUMN `approver_id` bigint NULL COMMENT '审批人' AFTER `status`;
ALTER TABLE `hr_vehicle_expense` ADD COLUMN `approved_at` datetime NULL COMMENT '审批时间' AFTER `approver_id`;
ALTER TABLE `hr_vehicle_expense` ADD COLUMN `approve_comment` varchar(300) NULL COMMENT '审批意见' AFTER `approved_at`;

ALTER TABLE `hr_performance_review` ADD COLUMN `final_score` decimal(6,2) NOT NULL DEFAULT 0 COMMENT '综合得分' AFTER `calibration`;

CREATE TABLE IF NOT EXISTS `hr_shift_schedule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `employee_id` bigint NOT NULL,
  `work_date` date NOT NULL,
  `shift_id` bigint NOT NULL,
  `shift_code` varchar(50) NOT NULL,
  `shift_name` varchar(100) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'PLANNED',
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_shift_schedule` (`tenant_id`, `employee_id`, `work_date`, `shift_id`),
  KEY `idx_hr_shift_schedule_date` (`tenant_id`, `work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工排班计划';

CREATE TABLE IF NOT EXISTS `hr_social_insurance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `salary_id` bigint NOT NULL,
  `employee_id` bigint NOT NULL,
  `period` varchar(20) NOT NULL,
  `item_code` varchar(32) NOT NULL,
  `item_name` varchar(60) NOT NULL,
  `base_amount` decimal(18,2) NOT NULL DEFAULT 0,
  `company_rate` decimal(6,4) NOT NULL DEFAULT 0,
  `personal_rate` decimal(6,4) NOT NULL DEFAULT 0,
  `company_amount` decimal(18,2) NOT NULL DEFAULT 0,
  `personal_amount` decimal(18,2) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_social_insurance` (`tenant_id`, `salary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社保公积金明细';

CREATE TABLE IF NOT EXISTS `hr_asset_stocktake` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `stocktake_no` varchar(60) NOT NULL,
  `stocktake_date` date NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `total_count` int NOT NULL DEFAULT 0,
  `diff_count` int NOT NULL DEFAULT 0,
  `remark` varchar(300) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_asset_stocktake` (`tenant_id`, `stocktake_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行政资产盘点单';

CREATE TABLE IF NOT EXISTS `hr_asset_stocktake_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `stocktake_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `book_status` varchar(24) NOT NULL,
  `actual_status` varchar(24) NOT NULL,
  `book_holder_id` bigint NULL,
  `actual_holder_id` bigint NULL,
  `difference` varchar(24) NOT NULL DEFAULT 'NORMAL',
  `remark` varchar(300) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_asset_stocktake_item` (`tenant_id`, `stocktake_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行政资产盘点明细';

CREATE TABLE IF NOT EXISTS `hr_asset_repair` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `repair_type` varchar(32) NOT NULL DEFAULT 'MAINTENANCE',
  `repair_reason` varchar(500) NOT NULL,
  `vendor` varchar(150) NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0,
  `repair_date` date NOT NULL,
  `finished_at` datetime NULL,
  `handler_id` bigint NULL,
  `status` varchar(24) NOT NULL DEFAULT 'REPAIRING',
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_asset_repair` (`tenant_id`, `asset_id`, `repair_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行政资产维修台账';

CREATE TABLE IF NOT EXISTS `hr_performance_kpi` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `kpi_code` varchar(60) NOT NULL,
  `kpi_name` varchar(150) NOT NULL,
  `category` varchar(50) NOT NULL DEFAULT 'GENERAL',
  `weight` decimal(5,2) NOT NULL DEFAULT 0,
  `target_value` decimal(18,2) NOT NULL DEFAULT 0,
  `unit` varchar(20) NOT NULL DEFAULT '',
  `description` varchar(500) NULL,
  `status` varchar(24) NOT NULL DEFAULT 'ENABLED',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hr_performance_kpi` (`tenant_id`, `kpi_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绩效KPI指标库';

CREATE TABLE IF NOT EXISTS `hr_performance_calibration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `period` varchar(20) NOT NULL,
  `calibration_date` date NOT NULL,
  `participant_count` int NOT NULL DEFAULT 0,
  `distribution` text NULL,
  `conclusion` varchar(500) NULL,
  `status` varchar(24) NOT NULL DEFAULT 'DRAFT',
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_performance_calibration` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绩效校准会议记录';
