-- 供应商门户独立账号体系：外部供应商人员登录身份，与内部账号隔离

CREATE TABLE IF NOT EXISTS `supplier_portal_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `supplier_id` BIGINT NOT NULL COMMENT '所属供应商ID',
  `username` VARCHAR(60) NOT NULL COMMENT '登录账号',
  `password_hash` VARCHAR(200) NOT NULL COMMENT '密码哈希',
  `display_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系人名称',
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(120) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DISABLED',
  `failed_login_count` INT NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
  `lock_until` DATETIME(3) NULL COMMENT '锁定截止时间',
  `last_login_at` DATETIME(3) NULL,
  `password_updated_at` DATETIME(3) NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_supplier_portal_user` (`tenant_id`, `username`),
  KEY `idx_supplier_portal_user_supplier` (`tenant_id`, `supplier_id`)
) ENGINE = InnoDB COMMENT '供应商门户账号';
