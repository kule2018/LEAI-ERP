-- 审批待办：支持转办/委托的有效期登记

ALTER TABLE `flow_task` ADD COLUMN `entrust_start_at` DATETIME NULL COMMENT '委托开始时间';
ALTER TABLE `flow_task` ADD COLUMN `entrust_end_at` DATETIME NULL COMMENT '委托结束时间';
