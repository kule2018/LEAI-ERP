-- 出货单：签收信息与签收凭证（照片等）

ALTER TABLE `shipment` ADD COLUMN `signed_at` DATETIME NULL COMMENT '签收时间' AFTER `tracking_no`;
ALTER TABLE `shipment` ADD COLUMN `signed_by` VARCHAR(60) NULL COMMENT '签收人' AFTER `signed_at`;
ALTER TABLE `shipment` ADD COLUMN `sign_evidence` JSON NULL COMMENT '签收凭证（照片、单号等）' AFTER `signed_by`;
