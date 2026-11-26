-- M42 销售客户域扩展：商机/报价/合同条款、客户合并审批与 POS 挂单

ALTER TABLE `crm_opportunity`
  ADD COLUMN `competitor` VARCHAR(150) NULL,
  ADD COLUMN `lost_reason` VARCHAR(300) NULL,
  ADD COLUMN `team_member_ids` JSON NULL;

ALTER TABLE `crm_quotation`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1,
  ADD COLUMN `approval_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `converted_order_id` BIGINT NULL;

ALTER TABLE `sale_contract`
  ADD COLUMN `clause_ids` JSON NULL,
  ADD COLUMN `esign_no` VARCHAR(80) NULL,
  ADD COLUMN `version` INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS `crm_customer_merge_request` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `from_customer_id` BIGINT NOT NULL,
  `to_customer_id` BIGINT NOT NULL,
  `reason` VARCHAR(500) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `check_result` JSON NULL,
  `approved_by` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_customer_merge` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pos_hang_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `hang_key` VARCHAR(100) NOT NULL,
  `store_id` BIGINT NULL,
  `customer_id` BIGINT NULL,
  `payload` JSON NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'HUNG',
  `resumed_order_id` BIGINT NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pos_hang_key` (`tenant_id`, `hang_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
