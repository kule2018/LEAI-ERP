-- 产品：增加最低销售价（底价），用于销售开单价格权限校验

ALTER TABLE `product` ADD COLUMN `floor_price` DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '最低销售价（底价），0 表示未设置';
