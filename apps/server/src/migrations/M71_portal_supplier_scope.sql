-- 供应商门户数据隔离：运单与发票归属供应商，供门户按供应商过滤

ALTER TABLE `logistics_waybill`
  ADD COLUMN `supplier_id` BIGINT NULL COMMENT '所属供应商ID' AFTER `carrier_id`;

ALTER TABLE `fin_invoice`
  ADD COLUMN `supplier_id` BIGINT NULL COMMENT '所属供应商ID' AFTER `invoice_type`;

CREATE INDEX `idx_logistics_waybill_supplier` ON `logistics_waybill` (`tenant_id`, `supplier_id`);
CREATE INDEX `idx_fin_invoice_supplier` ON `fin_invoice` (`tenant_id`, `supplier_id`);
