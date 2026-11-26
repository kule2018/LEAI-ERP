-- M96 统一告警规则：收敛库存、风险、安全、运维各域硬编码阈值
CREATE TABLE IF NOT EXISTS `alert_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `rule_code` varchar(64) NOT NULL,
  `rule_name` varchar(128) NOT NULL,
  `biz_type` varchar(64) NOT NULL,
  `metric` varchar(64) NOT NULL,
  `comparator` varchar(8) NOT NULL DEFAULT 'GTE',
  `threshold` decimal(18,4) NOT NULL DEFAULT 0,
  `window_minutes` int NOT NULL DEFAULT 0,
  `severity` varchar(16) NOT NULL DEFAULT 'MEDIUM',
  `notify_channels` json NULL,
  `enabled` tinyint NOT NULL DEFAULT 1,
  `description` varchar(255) NULL,
  `created_by` bigint NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_alert_rule_tenant` (`tenant_id`, `biz_type`),
  KEY `idx_alert_rule_metric` (`tenant_id`, `metric`),
  KEY `idx_alert_rule_code` (`tenant_id`, `rule_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 为已有租户补齐默认规则（幂等）
INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'RISK_CREDIT_OVER_RATIO', '信用超限高危比例', 'risk_alert', 'CREDIT_OVER_RATIO', 'GT', 0.2000, 0, 'HIGH', 1, '超限金额超过授信额度该比例时判定为高危'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'RISK_CREDIT_OVER_RATIO'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'RISK_STOCK_CRITICAL_RATIO', '库存低于安全线高危比例', 'risk_alert', 'STOCK_CRITICAL_RATIO', 'LTE', 0.5000, 0, 'HIGH', 1, '现有库存不高于安全库存该比例时判定为高危'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'RISK_STOCK_CRITICAL_RATIO'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'RISK_AR_MEDIUM_DAYS', '应收逾期中危天数', 'risk_alert', 'AR_MEDIUM_DAYS', 'GT', 7.0000, 0, 'MEDIUM', 1, '逾期天数大于该值判定为中危'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'RISK_AR_MEDIUM_DAYS'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'RISK_AR_HIGH_DAYS', '应收逾期高危天数', 'risk_alert', 'AR_HIGH_DAYS', 'GT', 30.0000, 0, 'HIGH', 1, '逾期天数大于该值判定为高危'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'RISK_AR_HIGH_DAYS'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'SECURITY_UNAUTHORIZED_ATTEMPTS', '越权访问告警次数', 'security_alert', 'SECURITY_UNAUTHORIZED_ATTEMPTS', 'GTE', 5.0000, 5, 'HIGH', 1, '窗口内累计越权次数达到该值触发安全告警'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'SECURITY_UNAUTHORIZED_ATTEMPTS'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'OPS_SLOW_REQUEST_MS', '慢请求耗时阈值', 'ops_monitor', 'OPS_SLOW_REQUEST_MS', 'GT', 1000.0000, 10, 'LOW', 1, '请求耗时超过该毫秒数记为慢请求'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'OPS_SLOW_REQUEST_MS'
WHERE r.`id` IS NULL;

INSERT INTO `alert_rule` (`tenant_id`, `rule_code`, `rule_name`, `biz_type`, `metric`, `comparator`, `threshold`, `window_minutes`, `severity`, `enabled`, `description`)
SELECT t.`id`, 'OPS_ERROR_RATE', '错误率告警阈值', 'ops_monitor', 'OPS_ERROR_RATE', 'GT', 0.1000, 10, 'MEDIUM', 1, '窗口内错误率超过该比例触发告警'
FROM `sys_tenant` t
LEFT JOIN `alert_rule` r ON r.`tenant_id` = t.`id` AND r.`rule_code` = 'OPS_ERROR_RATE'
WHERE r.`id` IS NULL;
