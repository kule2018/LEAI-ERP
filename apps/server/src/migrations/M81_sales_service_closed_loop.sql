-- 投诉工单流转轨迹 + 投诉重开 + 回访满意度 + 佣金发放联动应付单
CREATE TABLE IF NOT EXISTS `sales_complaint_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `complaint_id` bigint NOT NULL,
  `action` varchar(20) NOT NULL,
  `from_status` varchar(20) NOT NULL DEFAULT '',
  `to_status` varchar(20) NOT NULL DEFAULT '',
  `operator_id` bigint DEFAULT NULL,
  `operator_name` varchar(60) NOT NULL DEFAULT '',
  `remark` varchar(500) DEFAULT NULL,
  `duration_ms` int NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_complaint_log` (`tenant_id`,`complaint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `sales_complaint`
  ADD COLUMN `reopen_count` int NOT NULL DEFAULT 0 AFTER `resolved_at`,
  ADD COLUMN `last_action_at` datetime DEFAULT NULL AFTER `reopen_count`;

ALTER TABLE `sales_visit`
  ADD COLUMN `satisfaction` int DEFAULT NULL AFTER `status`,
  ADD COLUMN `completed_at` datetime DEFAULT NULL AFTER `satisfaction`;

ALTER TABLE `sales_commission_record`
  ADD COLUMN `payable_id` bigint DEFAULT NULL AFTER `status`,
  ADD COLUMN `payable_no` varchar(60) DEFAULT NULL AFTER `payable_id`,
  ADD COLUMN `paid_at` datetime DEFAULT NULL AFTER `payable_no`;