-- 销售单：支持拆单（父单 / 拆分批次号）

ALTER TABLE `sale_order` ADD COLUMN `parent_order_id` BIGINT NULL COMMENT '拆单来源单据ID' AFTER `flow_instance_id`;
ALTER TABLE `sale_order` ADD COLUMN `split_batch_no` VARCHAR(60) NULL COMMENT '拆分批次号' AFTER `parent_order_id`;
CREATE INDEX `idx_sale_order_parent` ON `sale_order` (`tenant_id`, `parent_order_id`);
