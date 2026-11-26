-- M97 统一通知规则：业务事件 → 模板 + 渠道 + 接收人的可配置映射
CREATE TABLE IF NOT EXISTS `notify_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `rule_code` varchar(64) NOT NULL,
  `rule_name` varchar(128) NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `biz_type` varchar(64) NOT NULL,
  `template_code` varchar(64) NOT NULL,
  `channels` varchar(200) NULL,
  `level` varchar(16) NOT NULL DEFAULT 'MEDIUM',
  `receiver_type` varchar(16) NOT NULL DEFAULT 'ROLE',
  `receiver_ids` json NULL,
  `priority` int NOT NULL DEFAULT 100,
  `enabled` tinyint NOT NULL DEFAULT 1,
  `description` varchar(255) NULL,
  `created_by` bigint NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notify_rule_code` (`tenant_id`, `rule_code`),
  KEY `idx_notify_rule_tenant` (`tenant_id`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 为已有租户补齐默认通知规则（幂等）
INSERT INTO `notify_rule` (`tenant_id`, `rule_code`, `rule_name`, `event_type`, `biz_type`, `template_code`, `channels`, `level`, `receiver_type`, `receiver_ids`, `priority`, `enabled`, `description`)
SELECT t.`id`, 'SALE_ORDER_SUBMIT', '销售订单提交通知', 'SALE_ORDER_SUBMIT', 'sales', 'SALE_ORDER_SUBMIT', 'INMAIL', 'LOW', 'ALL', JSON_ARRAY(), 100, 1, '销售订单提交审批后通知相关人员'
FROM `sys_tenant` t
LEFT JOIN `notify_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'SALE_ORDER_SUBMIT'
WHERE r.`id` IS NULL;

INSERT INTO `notify_rule` (`tenant_id`, `rule_code`, `rule_name`, `event_type`, `biz_type`, `template_code`, `channels`, `level`, `receiver_type`, `receiver_ids`, `priority`, `enabled`, `description`)
SELECT t.`id`, 'STOCK_ALERT', '库存预警通知', 'STOCK_ALERT', 'inventory', 'STOCK_ALERT', 'INMAIL,EMAIL', 'HIGH', 'ALL', JSON_ARRAY(), 50, 1, '库存低于安全线时高危通知'
FROM `sys_tenant` t
LEFT JOIN `notify_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'STOCK_ALERT'
WHERE r.`id` IS NULL;

INSERT INTO `notify_rule` (`tenant_id`, `rule_code`, `rule_name`, `event_type`, `biz_type`, `template_code`, `channels`, `level`, `receiver_type`, `receiver_ids`, `priority`, `enabled`, `description`)
SELECT t.`id`, 'RISK_ALERT', '风险预警通知', 'RISK_ALERT', 'risk', 'RISK_ALERT', 'INMAIL', 'HIGH', 'ALL', JSON_ARRAY(), 50, 1, '风险扫描命中高危时通知'
FROM `sys_tenant` t
LEFT JOIN `notify_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'RISK_ALERT'
WHERE r.`id` IS NULL;

INSERT INTO `notify_rule` (`tenant_id`, `rule_code`, `rule_name`, `event_type`, `biz_type`, `template_code`, `channels`, `level`, `receiver_type`, `receiver_ids`, `priority`, `enabled`, `description`)
SELECT t.`id`, 'SECURITY_ALERT', '安全越权告警', 'SECURITY_ALERT', 'security', 'SECURITY_ALERT', 'INMAIL,EMAIL', 'CRITICAL', 'ALL', JSON_ARRAY(), 10, 1, '越权访问次数超阈值时告警'
FROM `sys_tenant` t
LEFT JOIN `notify_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'SECURITY_ALERT'
WHERE r.`id` IS NULL;
