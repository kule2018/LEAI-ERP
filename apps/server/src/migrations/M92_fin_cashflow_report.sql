-- M92 正式现金流量表出具记录：快照固化与出具留痕
CREATE TABLE IF NOT EXISTS `fin_cashflow_report` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `report_no` varchar(60) NOT NULL,
  `period` varchar(20) NOT NULL,
  `report_type` varchar(24) NOT NULL DEFAULT 'OFFICIAL',
  `snapshot` json NULL,
  `status` varchar(24) NOT NULL DEFAULT 'ISSUED',
  `issued_by` bigint NULL,
  `issued_at` datetime NULL,
  `remark` varchar(255) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_fin_cashflow_report` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
