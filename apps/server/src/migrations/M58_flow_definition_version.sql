-- 流程定义：表单设计字段 + 版本快照（变更留痕与回溯）

ALTER TABLE `flow_definition` ADD COLUMN `form_schema` JSON NULL COMMENT '表单字段设计 JSON';

CREATE TABLE IF NOT EXISTS `flow_definition_version` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL DEFAULT 0,
  `definition_id` BIGINT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `form_schema` JSON NULL,
  `nodes` JSON NULL,
  `remark` VARCHAR(500) NULL,
  `changed_by` BIGINT NULL,
  `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_flow_def_version_def` (`tenant_id`, `definition_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
