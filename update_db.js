import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });

  await connection.query(`USE \`learnsrinagar\`;`);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE
    );
  `);

  await connection.query(`
    INSERT IGNORE INTO roles (id, name) VALUES (1, 'student');
  `);

  try { await connection.query(`ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER id;`); } catch(e) {}
  try { await connection.query(`ALTER TABLE users ADD COLUMN role_id INT AFTER password_hash;`); } catch(e) {}

  await connection.query(`
    UPDATE users SET name='Test Student', role_id=1 WHERE email='test@test.com';
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE,
      class_id INT,
      schools_id INT
    );
  `);
  
  const [rows] = await connection.query(`SELECT id FROM users WHERE email='test@test.com'`);
  if (rows && rows.length > 0) {
     const userId = rows[0].id;
     await connection.query(`INSERT IGNORE INTO student_profiles (user_id, class_id, schools_id) VALUES (?, 1, 1)`, [userId]);
  }

  // --- Notification System ---
  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('system', 'manual') NOT NULL DEFAULT 'system',
      event_type VARCHAR(50) DEFAULT NULL,
      target_type ENUM('all', 'role', 'group', 'class', 'school', 'user') NOT NULL,
      target_id VARCHAR(100) DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_notifications_created_at (created_at),
      KEY idx_notifications_target (target_type, target_id),
      CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      notification_id INT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      delivered_at TIMESTAMP NULL DEFAULT NULL,
      read_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_notification (user_id, notification_id),
      CONSTRAINT fk_un_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_un_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token TEXT NOT NULL,
      device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_device_tokens_user_id (user_id),
      CONSTRAINT fk_dt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // --- Homework System ---
  await connection.query(`
    CREATE TABLE IF NOT EXISTS homework (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subject_id INT DEFAULT NULL,
      teacher_id INT DEFAULT NULL,
      class_id INT DEFAULT NULL,
      title VARCHAR(255) DEFAULT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY subject_id (subject_id),
      KEY teacher_id (teacher_id),
      KEY class_id (class_id),
      CONSTRAINT fk_homework_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE SET NULL,
      CONSTRAINT fk_homework_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL,
      CONSTRAINT fk_homework_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  console.log('Update complete.');
  process.exit(0);

}
main();
