-- M23 销售退货质检与审批

ALTER TABLE `sale_return`
  ADD COLUMN `approved_by` BIGINT NULL COMMENT '审批人' AFTER `refund_amount`,
  ADD COLUMN `approved_at` DATETIME(3) NULL COMMENT '审批时间' AFTER `approved_by`,
  ADD COLUMN `red_invoice_no` VARCHAR(80) NULL COMMENT '红字发票号' AFTER `approved_at`;

ALTER TABLE `sale_return_line`
  ADD COLUMN `qc_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT '退货质检状态' AFTER `disposal`;
