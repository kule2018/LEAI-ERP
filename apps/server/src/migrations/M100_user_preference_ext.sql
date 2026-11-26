-- M100 用户偏好扩展：快捷搜索历史与草稿
CREATE TABLE IF NOT EXISTS `quick_search_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `keyword` varchar(128) NOT NULL,
  `count` int NOT NULL DEFAULT 1,
  `last_used_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_quick_search_log` (`tenant_id`, `user_id`, `keyword`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_draft` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `draft_key` varchar(160) NOT NULL,
  `content` json NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_draft` (`tenant_id`, `user_id`, `draft_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
