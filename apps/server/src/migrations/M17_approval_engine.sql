-- M17 审批引擎增强：审批模式、超时、快照、委托、加签

ALTER TABLE `flow_node`
  ADD COLUMN `approval_mode` VARCHAR(24) NOT NULL DEFAULT 'SEQUENTIAL' COMMENT '审批模式 ANY/ALL/SEQUENTIAL' AFTER `condition_expr`,
  ADD COLUMN `timeout_hours` INT NULL COMMENT '节点超时小时数' AFTER `approval_mode`;

ALTER TABLE `flow_instance`
  ADD COLUMN `snapshot` JSON NULL COMMENT '发起时流程定义快照' AFTER `current_node_id`,
  ADD COLUMN `escalated` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已超时升级' AFTER `snapshot`;

ALTER TABLE `flow_task`
  ADD COLUMN `delegated_to` BIGINT NULL COMMENT '委托人' AFTER `status`,
  ADD COLUMN `added_by` BIGINT NULL COMMENT '加签发起人' AFTER `delegated_to`;
