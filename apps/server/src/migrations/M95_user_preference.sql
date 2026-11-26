-- M95 用户视图配置与个人收藏
CREATE TABLE IF NOT EXISTS `user_view_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `page_key` varchar(128) NOT NULL,
  `config` json NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_view_config` (`tenant_id`, `user_id`, `page_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_favorite` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `target_type` varchar(24) NOT NULL DEFAULT 'PAGE',
  `target_key` varchar(128) NOT NULL,
  `title` varchar(128) NOT NULL,
  `route` varchar(255) NULL,
  `biz_type` varchar(64) NULL,
  `biz_id` bigint NULL,
  `remark` varchar(255) NULL,
  `sort_no` int NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_favorite` (`tenant_id`, `user_id`, `target_type`, `target_key`),
  KEY `idx_user_favorite_user` (`tenant_id`, `user_id`, `target_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
