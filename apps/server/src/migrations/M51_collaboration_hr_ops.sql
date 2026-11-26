-- M51 协同与人事增强：敏感词、已读回执、公告确认、会议纪要、补卡审批、薪酬发放审批、绩效申诉、证书到期、车队费用轨迹

ALTER TABLE oa_chat_message
  ADD COLUMN read_flag VARCHAR(8) NOT NULL DEFAULT 'NO' COMMENT '已读标记' AFTER content,
  ADD COLUMN read_at DATETIME NULL COMMENT '已读时间' AFTER read_flag;

ALTER TABLE oa_task
  ADD COLUMN source VARCHAR(24) NOT NULL DEFAULT 'MANUAL' COMMENT '任务来源 MANUAL/MEETING/FLOW' AFTER status,
  ADD COLUMN meeting_id BIGINT NULL COMMENT '来源会议ID' AFTER source;

ALTER TABLE hr_salary
  ADD COLUMN approved_by BIGINT NULL COMMENT '审批人' AFTER status,
  ADD COLUMN approved_at DATETIME NULL COMMENT '审批时间' AFTER approved_by,
  ADD COLUMN payslip_no VARCHAR(60) NULL COMMENT '工资条编号' AFTER approved_at;

ALTER TABLE hr_performance_review
  ADD COLUMN appeal_resolution VARCHAR(500) NULL COMMENT '申诉处理结论' AFTER appeal_reason,
  ADD COLUMN appeal_handled_by BIGINT NULL COMMENT '申诉处理人' AFTER appeal_resolution,
  ADD COLUMN appeal_handled_at DATETIME NULL COMMENT '申诉处理时间' AFTER appeal_handled_by;

ALTER TABLE hr_training_record
  ADD COLUMN expire_date DATE NULL COMMENT '证书到期日' AFTER certificate_no;

CREATE TABLE IF NOT EXISTS `oa_sensitive_word` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  word VARCHAR(120) NOT NULL COMMENT '敏感词',
  level VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' COMMENT 'LOW/MEDIUM/HIGH',
  enabled VARCHAR(8) NOT NULL DEFAULT 'YES' COMMENT 'YES/NO',
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_deleted TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_oa_sensitive_word (tenant_id, word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协同敏感词库';

CREATE TABLE IF NOT EXISTS `oa_notice_confirm` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  notice_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  confirmed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_oa_notice_confirm (tenant_id, notice_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告确认记录';

CREATE TABLE IF NOT EXISTS `oa_meeting` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  project_id BIGINT NULL,
  title VARCHAR(200) NOT NULL,
  meeting_at DATETIME NULL,
  location VARCHAR(200) NULL,
  minutes TEXT NULL COMMENT '会议纪要（可含任务行）',
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_deleted TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_oa_meeting (tenant_id, meeting_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议与纪要';

CREATE TABLE IF NOT EXISTS `hr_punch_request` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  punch_date DATE NOT NULL,
  punch_type VARCHAR(24) NOT NULL DEFAULT 'MISSING' COMMENT 'MISSING/LATE/EARLY',
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/APPROVED/REJECTED',
  approver_id BIGINT NULL,
  approved_at DATETIME NULL,
  approve_comment VARCHAR(300) NULL,
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hr_punch_request (tenant_id, employee_id, punch_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='补卡申请与审批';

CREATE TABLE IF NOT EXISTS `hr_vehicle_expense` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  vehicle_id BIGINT NOT NULL,
  vehicle_use_id BIGINT NULL,
  expense_type VARCHAR(24) NOT NULL DEFAULT 'FUEL' COMMENT 'FUEL/TOLL/PARK/REPAIR/OTHER',
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  remark VARCHAR(300) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hr_vehicle_expense (tenant_id, vehicle_id, expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车队费用';

CREATE TABLE IF NOT EXISTS `hr_vehicle_track` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  vehicle_id BIGINT NOT NULL,
  vehicle_use_id BIGINT NULL,
  longitude DECIMAL(10,6) NOT NULL,
  latitude DECIMAL(10,6) NOT NULL,
  speed DECIMAL(12,2) NOT NULL DEFAULT 0,
  tracked_at DATETIME NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hr_vehicle_track (tenant_id, vehicle_id, tracked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车辆轨迹';
