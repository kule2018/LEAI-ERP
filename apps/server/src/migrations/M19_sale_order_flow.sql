-- M19 销售单审批流关联

ALTER TABLE `sale_order`
  ADD COLUMN `flow_instance_id` BIGINT NULL COMMENT '关联的工作流实例 ID' AFTER `credit_occupied`;
