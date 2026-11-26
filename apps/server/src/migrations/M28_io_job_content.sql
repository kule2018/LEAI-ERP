-- M28 异步导出任务内容存储

ALTER TABLE `io_job`
  ADD COLUMN `content` TEXT NULL COMMENT '生成的导出内容' AFTER `result_url`;
