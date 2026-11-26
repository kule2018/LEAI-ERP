-- 多语言语言包
CREATE TABLE IF NOT EXISTS `sys_lang` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `lang_code` varchar(16) NOT NULL,
  `locale_name` varchar(60) NOT NULL,
  `resource_key` varchar(200) NOT NULL,
  `resource_value` varchar(500) NOT NULL,
  `fallback_lang` varchar(16) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_lang` (`tenant_id`,`lang_code`,`resource_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 内置语言包基线数据
INSERT IGNORE INTO `sys_lang` (`tenant_id`,`lang_code`,`locale_name`,`resource_key`,`resource_value`,`fallback_lang`,`status`)
VALUES
  (0,'zh_CN','简体中文','common.action.confirm','确认',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','common.action.cancel','取消',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','common.action.save','保存',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','common.action.export','导出',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','common.action.import','导入',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','nav.dashboard','工作台',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','nav.sales.order','销售订单',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','nav.purchase.order','采购订单',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','nav.inventory.stock','库存查询',NULL,'ENABLED'),
  (0,'zh_CN','简体中文','nav.finance.report','财务报表',NULL,'ENABLED'),
  (0,'en_US','English','common.action.confirm','Confirm',NULL,'ENABLED'),
  (0,'en_US','English','common.action.cancel','Cancel',NULL,'ENABLED'),
  (0,'en_US','English','common.action.save','Save',NULL,'ENABLED'),
  (0,'en_US','English','common.action.export','Export',NULL,'ENABLED'),
  (0,'en_US','English','common.action.import','Import',NULL,'ENABLED'),
  (0,'en_US','English','nav.dashboard','Dashboard',NULL,'ENABLED'),
  (0,'en_US','English','nav.sales.order','Sales Order',NULL,'ENABLED'),
  (0,'en_US','English','nav.purchase.order','Purchase Order',NULL,'ENABLED'),
  (0,'en_US','English','nav.inventory.stock','Stock Query',NULL,'ENABLED'),
  (0,'en_US','English','nav.finance.report','Financial Report',NULL,'ENABLED');
