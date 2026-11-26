-- M103 异步导出任务保存发起时的数据权限快照，避免 worker 以超管身份越权导出

ALTER TABLE `io_job`
  ADD COLUMN `scope_json` TEXT NULL COMMENT '发起导出时的数据权限快照' AFTER `content`;
