-- M21 调拨状态机在途字段

ALTER TABLE `stock_transfer_line`
  ADD COLUMN `shipped_qty` DECIMAL(18, 3) NOT NULL DEFAULT 0 COMMENT '已发货数量（在途）' AFTER `received_qty`;
