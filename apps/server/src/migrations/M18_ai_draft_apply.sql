-- M18 AI 草稿确认写回业务单据

ALTER TABLE `ai_audit_log`
  ADD COLUMN `applied_biz_type` VARCHAR(64) NULL COMMENT '写回的业务类型' AFTER `response`,
  ADD COLUMN `applied_biz_id` BIGINT NULL COMMENT '写回的业务单据 ID' AFTER `applied_biz_type`,
  ADD COLUMN `applied_at` DATETIME(3) NULL COMMENT '写回时间' AFTER `applied_biz_id`,
  ADD COLUMN `apply_error` VARCHAR(1000) NULL COMMENT '写回失败原因' AFTER `applied_at`;
