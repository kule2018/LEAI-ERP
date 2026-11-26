-- M37 权限：角色继承与数据权限运行时字段

ALTER TABLE `sys_role`
  ADD COLUMN `parent_id` BIGINT NULL AFTER `data_scope_level`,
  ADD KEY `idx_sys_role_parent` (`tenant_id`, `parent_id`);
