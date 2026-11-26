-- M49 平台治理扩展：越权访问告警、慢 SQL 采集、通知渠道投递留痕

ALTER TABLE print_record
  ADD COLUMN duplicate_warning VARCHAR(500) NULL COMMENT '重复打印提示（同一单据短时间重复打印）' AFTER watermark;

ALTER TABLE sys_user
  ADD COLUMN email VARCHAR(120) NULL COMMENT '邮箱（通知渠道投递）' AFTER mobile;

ALTER TABLE sys_notify
  ADD COLUMN target_address VARCHAR(120) NULL COMMENT '外部渠道投递地址（邮箱/手机号/企微ID）' AFTER channel,
  ADD COLUMN delivered_at DATETIME(3) NULL COMMENT '投递成功时间' AFTER send_status,
  ADD COLUMN gateway_message_id VARCHAR(80) NULL COMMENT '渠道网关返回的消息ID' AFTER delivered_at;

CREATE TABLE IF NOT EXISTS `sys_security_alert` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL COMMENT '租户ID',
  user_id BIGINT NOT NULL COMMENT '越权用户ID',
  username VARCHAR(64) NULL COMMENT '用户名',
  perm VARCHAR(120) NULL COMMENT '尝试访问的权限码',
  path VARCHAR(255) NULL COMMENT '请求路径',
  method VARCHAR(16) NULL COMMENT '请求方法',
  attempts INT NOT NULL DEFAULT 1 COMMENT '窗口内累计越权次数',
  level VARCHAR(16) NOT NULL DEFAULT 'LOW' COMMENT '告警级别 LOW/HIGH',
  reason VARCHAR(500) NULL COMMENT '告警说明',
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/CONFIRMED/CLOSED',
  confirmed_by BIGINT NULL COMMENT '确认人',
  confirmed_at DATETIME(3) NULL COMMENT '确认时间',
  occurred_at DATETIME(3) NOT NULL COMMENT '发生时间',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_deleted TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_security_alert_tenant_status (tenant_id, status, is_deleted),
  KEY idx_security_alert_user (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='越权访问安全告警';

CREATE TABLE IF NOT EXISTS `sys_slow_sql_log` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 0 COMMENT '租户ID（系统级为0）',
  sql_text VARCHAR(1000) NOT NULL COMMENT 'SQL 文本',
  duration_ms INT NOT NULL COMMENT '耗时（毫秒）',
  row_count INT NOT NULL DEFAULT 0 COMMENT '影响行数',
  threshold_ms INT NOT NULL DEFAULT 500 COMMENT '判定阈值',
  captured_at DATETIME(3) NOT NULL COMMENT '采集时间',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_slow_sql_captured (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='慢 SQL 采集';
