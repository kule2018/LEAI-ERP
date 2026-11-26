-- M102 AI 智能询比价长任务：缺货缺口、供应商报价、规则比价、人工确认与评测

CREATE TABLE IF NOT EXISTS `ai_procurement_advice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `task_no` VARCHAR(60) NOT NULL COMMENT '任务编号',
  `product_name` VARCHAR(150) NOT NULL COMMENT '缺货产品',
  `shortage_qty` DECIMAL(18,3) NOT NULL DEFAULT 0 COMMENT '缺口数量',
  `rule_text` TEXT NULL COMMENT '采购规则说明',
  `suppliers_json` JSON NULL COMMENT '询价供应商与询价单号',
  `quotes_json` JSON NULL COMMENT '供应商报价、原文依据与规则校验',
  `suggestion_json` JSON NULL COMMENT '有依据的采购建议',
  `status` VARCHAR(24) NOT NULL DEFAULT 'WAITING' COMMENT 'WAITING/PAUSED/READY/CONFIRMED/REJECTED',
  `progress` VARCHAR(24) NOT NULL DEFAULT 'INQUIRING' COMMENT 'INQUIRING/QUOTED/SUGGESTED/DONE',
  `resume_count` INT NOT NULL DEFAULT 0 COMMENT '中断恢复次数',
  `remind_count` INT NOT NULL DEFAULT 0 COMMENT '催办次数',
  `draft_no` VARCHAR(60) NULL COMMENT '确认后生成的采购草稿号',
  `evaluation_json` JSON NULL COMMENT '评测记录',
  `confirmed_by` BIGINT NULL,
  `confirmed_at` DATETIME(3) NULL,
  `created_by` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_procurement_advice_no` (`tenant_id`, `task_no`),
  KEY `idx_ai_procurement_advice_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
