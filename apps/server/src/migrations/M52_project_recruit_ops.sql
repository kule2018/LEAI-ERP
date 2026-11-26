-- 项目管理与招聘/绩效增强：里程碑、工时、项目风险、绩效 360 反馈
ALTER TABLE `oa_task` ADD COLUMN `start_date` date NULL COMMENT '计划开始日期' AFTER `assignee_id`;

CREATE TABLE IF NOT EXISTS `oa_project_milestone` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `project_id` bigint NOT NULL,
  `milestone_name` varchar(150) NOT NULL,
  `plan_date` date NULL,
  `actual_date` date NULL,
  `owner_id` bigint NULL,
  `status` varchar(24) NOT NULL DEFAULT 'PLANNED',
  `remark` varchar(300) NULL,
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oa_project_milestone` (`tenant_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目里程碑';

CREATE TABLE IF NOT EXISTS `oa_task_worklog` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `task_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `work_date` date NOT NULL,
  `hours` decimal(5,2) NOT NULL DEFAULT 0,
  `content` varchar(500) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oa_task_worklog` (`tenant_id`, `task_id`, `work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务工时记录';

CREATE TABLE IF NOT EXISTS `oa_project_risk` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `project_id` bigint NOT NULL,
  `risk_title` varchar(200) NOT NULL,
  `risk_level` varchar(16) NOT NULL DEFAULT 'MEDIUM',
  `probability` int NOT NULL DEFAULT 3,
  `impact` int NOT NULL DEFAULT 3,
  `owner_id` bigint NULL,
  `mitigation` varchar(500) NULL,
  `status` varchar(24) NOT NULL DEFAULT 'OPEN',
  `created_by` bigint NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oa_project_risk` (`tenant_id`, `project_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目风险';

CREATE TABLE IF NOT EXISTS `hr_performance_feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `review_id` bigint NOT NULL,
  `evaluator_id` bigint NOT NULL,
  `feedback_type` varchar(16) NOT NULL DEFAULT 'PEER',
  `score` int NOT NULL DEFAULT 0,
  `comment` varchar(500) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hr_performance_feedback` (`tenant_id`, `review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绩效360反馈';
