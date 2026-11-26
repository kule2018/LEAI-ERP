-- M24 质检让步接收

ALTER TABLE `mes_qc`
  ADD COLUMN `concession_by` BIGINT NULL COMMENT '让步接收审批人' AFTER `inspector_id`,
  ADD COLUMN `concession_reason` VARCHAR(500) NULL COMMENT '让步接收原因' AFTER `concession_by`,
  ADD COLUMN `concession_at` DATETIME(3) NULL COMMENT '让步接收时间' AFTER `concession_reason`;
