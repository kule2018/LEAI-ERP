-- M50 库存作业增强：调拨签收差异、拆装批次继承、盘点扫码、条码标签与序列号

ALTER TABLE stock_transfer_line
  ADD COLUMN diff_qty DECIMAL(18,3) NOT NULL DEFAULT 0 COMMENT '签收差异数量（负数表示短收）' AFTER shipped_qty,
  ADD COLUMN diff_reason VARCHAR(255) NULL COMMENT '差异原因说明' AFTER diff_qty;

ALTER TABLE stock_assembly_line
  ADD COLUMN variant_id BIGINT NOT NULL DEFAULT 0 COMMENT '变体ID' AFTER product_id,
  ADD COLUMN batch_no VARCHAR(60) NOT NULL DEFAULT '' COMMENT '批次号（批次继承）' AFTER variant_id;

CREATE TABLE IF NOT EXISTS `print_label_instance` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  label_template_id BIGINT NOT NULL COMMENT '标签模板ID',
  template_code VARCHAR(60) NOT NULL COMMENT '标签模板编码',
  product_id BIGINT NOT NULL COMMENT '产品ID',
  variant_id BIGINT NOT NULL DEFAULT 0 COMMENT '变体ID',
  serial_no VARCHAR(80) NOT NULL COMMENT '标签序列号（条码唯一）',
  barcode_type VARCHAR(24) NOT NULL DEFAULT 'CODE128' COMMENT '条码类型',
  batch_no VARCHAR(60) NOT NULL DEFAULT '' COMMENT '批次号',
  quantity DECIMAL(18,3) NOT NULL DEFAULT 1 COMMENT '标签数量',
  print_count INT NOT NULL DEFAULT 0 COMMENT '已打印次数',
  last_printed_at DATETIME(3) NULL COMMENT '最近打印时间',
  status VARCHAR(24) NOT NULL DEFAULT 'GENERATED' COMMENT 'GENERATED/PRINTED/VOID',
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_deleted TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_print_label_serial (tenant_id, serial_no),
  KEY idx_print_label_product (tenant_id, product_id, variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='条码标签实例与序列号';

CREATE TABLE IF NOT EXISTS `print_barcode_rule` (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  rule_code VARCHAR(60) NOT NULL COMMENT '规则编码',
  prefix VARCHAR(20) NOT NULL DEFAULT '' COMMENT '前缀',
  date_format VARCHAR(16) NOT NULL DEFAULT 'yyyyMMdd' COMMENT '日期片段格式',
  seq_length INT NOT NULL DEFAULT 6 COMMENT '流水号位数',
  reset_cycle VARCHAR(16) NOT NULL DEFAULT 'DAILY' COMMENT 'NONE/DAILY/MONTHLY/YEARLY',
  barcode_type VARCHAR(24) NOT NULL DEFAULT 'CODE128' COMMENT '条码类型',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DISABLED',
  remark VARCHAR(255) NULL,
  created_by BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_deleted TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_print_barcode_rule (tenant_id, rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='条码编码规则';
