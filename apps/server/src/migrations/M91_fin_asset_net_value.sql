-- M91 固定资产账面净值列：计提折旧时同步回写，便于台账与报表直接取数
ALTER TABLE `fin_asset`
  ADD COLUMN `net_value` decimal(18,4) NOT NULL DEFAULT 0 COMMENT '账面净值' AFTER `depreciated_value`;

-- 初始化存量数据：净值 = 原值 - 累计折旧
UPDATE `fin_asset` SET `net_value` = GREATEST(`original_value` - `depreciated_value`, 0);
