-- M31 打印补打记录溯源

ALTER TABLE `print_record`
  ADD COLUMN `reprint_of` BIGINT NULL COMMENT '补打来源记录 ID' AFTER `template_code`;
