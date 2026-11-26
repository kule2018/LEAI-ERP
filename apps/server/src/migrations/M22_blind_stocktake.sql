-- M22 盲盘与复盘

ALTER TABLE `stocktake`
  ADD COLUMN `blind_mode` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否盲盘' AFTER `plan_date`;

ALTER TABLE `stocktake_line`
  ADD COLUMN `recount_qty` DECIMAL(18, 3) NULL COMMENT '复盘数量' AFTER `actual_qty`;
