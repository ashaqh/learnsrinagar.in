-- Notification System Migration

-- 1. Notifications Master Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('system', 'manual') NOT NULL DEFAULT 'system',
  `event_type` varchar(50) DEFAULT NULL, -- e.g., 'CLASS_SCHEDULED', 'BLOG_POSTED'
  `target_type` enum('all', 'role', 'group', 'class', 'school', 'user') NOT NULL,
  `target_id` varchar(100) DEFAULT NULL, -- role_id, class_id, etc.
  `metadata` json DEFAULT NULL, -- Any extra data like links, image URLs
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_created_at` (`created_at`),
  KEY `idx_notifications_target` (`target_type`, `target_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. User Notifications (Delivery Tracking)
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `notification_id` int NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `delivered_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_notification` (`user_id`, `notification_id`),
  KEY `user_id` (`user_id`),
  KEY `notification_id` (`notification_id`),
  KEY `idx_user_notifications_read` (`user_id`, `is_read`),
  CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_notifications_ibfk_2` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Device Tokens (FCM)
CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` text NOT NULL,
  `device_type` enum('android', 'ios', 'web') DEFAULT 'android',
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_unique` (`token`(255)),
  KEY `user_id` (`user_id`),
  KEY `idx_device_tokens_user_id` (`user_id`),
  CONSTRAINT `device_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. User Notification Settings (Optional but required by user)
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `user_id` int NOT NULL,
  `classes_enabled` tinyint(1) DEFAULT '1',
  `blogs_enabled` tinyint(1) DEFAULT '1',
  `feedback_enabled` tinyint(1) DEFAULT '1',
  `is_muted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
