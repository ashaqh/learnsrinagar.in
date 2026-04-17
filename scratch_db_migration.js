import mysql from 'mysql2/promise';

const dbConfig = {
    host: '127.0.0.1',
    user: 'learnsrinagar',
    password: 'e3iWzvZnZifgN38OiM2Q',
    database: 'learnsrinagar',
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // 1. Alter live_classes
        console.log('Adding zoom_link to live_classes...');
        try {
            await connection.query('ALTER TABLE live_classes ADD COLUMN zoom_link TEXT AFTER youtube_live_link');
            console.log('Successfully added zoom_link.');
        } catch (e) {
            if (e.code === 'ER_DUP_COLUMN_NAME') {
                console.log('zoom_link already exists.');
            } else {
                throw e;
            }
        }

        // 2. Notification Tables
        const statements = [
            `CREATE TABLE IF NOT EXISTS notifications (
                id int NOT NULL AUTO_INCREMENT,
                title varchar(255) NOT NULL,
                message text NOT NULL,
                type enum('system', 'manual') NOT NULL DEFAULT 'system',
                event_type varchar(50) DEFAULT NULL,
                target_type enum('all', 'role', 'group', 'class', 'school', 'user') NOT NULL,
                target_id varchar(100) DEFAULT NULL,
                metadata json DEFAULT NULL,
                created_by int DEFAULT NULL,
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_notifications_created_at (created_at),
                KEY idx_notifications_target (target_type, target_id),
                CONSTRAINT notifications_ibfk_1 FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            
            `CREATE TABLE IF NOT EXISTS user_notifications (
                id int NOT NULL AUTO_INCREMENT,
                user_id int NOT NULL,
                notification_id int NOT NULL,
                is_read tinyint(1) DEFAULT '0',
                delivered_at timestamp NULL DEFAULT NULL,
                read_at timestamp NULL DEFAULT NULL,
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uniq_user_notification (user_id, notification_id),
                KEY idx_user_notifications_read (user_id, is_read),
                KEY idx_user_notifications_notification (notification_id),
                CONSTRAINT user_notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT user_notifications_ibfk_2 FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            
            `CREATE TABLE IF NOT EXISTS device_tokens (
                id int NOT NULL AUTO_INCREMENT,
                user_id int NOT NULL,
                token text NOT NULL,
                device_type enum('android', 'ios', 'web') DEFAULT 'android',
                last_updated timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY token_unique (token(255)),
                KEY idx_device_tokens_user_id (user_id),
                CONSTRAINT device_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            
            `CREATE TABLE IF NOT EXISTS notification_settings (
                user_id int NOT NULL,
                classes_enabled tinyint(1) DEFAULT '1',
                blogs_enabled tinyint(1) DEFAULT '1',
                feedback_enabled tinyint(1) DEFAULT '1',
                is_muted tinyint(1) DEFAULT '0',
                PRIMARY KEY (user_id),
                CONSTRAINT notification_settings_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            
            `INSERT IGNORE INTO notification_settings (user_id)
             SELECT id FROM users`,
        ];

        for (const statement of statements) {
            console.log('Executing statement...');
            await connection.query(statement);
        }
        
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
