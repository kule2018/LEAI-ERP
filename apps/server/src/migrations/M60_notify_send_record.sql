-- 通知发送记录：记录通知来源模板，便于按模板检索投递记录与失败重试

ALTER TABLE `sys_notify` ADD COLUMN `template_code` VARCHAR(64) NULL COMMENT '来源通知模板编码';
ALTER TABLE `sys_notify` ADD COLUMN `send_user_id` BIGINT NULL COMMENT '发送操作人';

CREATE INDEX `idx_sys_notify_template_code` ON `sys_notify` (`tenant_id`, `template_code`);
CREATE INDEX `idx_sys_notify_send_status` ON `sys_notify` (`tenant_id`, `send_status`);
