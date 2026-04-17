// init_db.js
// Script to create the MySQL database, users table, and seed a test user.
// Run with: node init_db.js

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  // Use environment variables (fallback to defaults)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });

  // Create database if it doesn't exist
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`learnsrinagar\`;`);
  await connection.query(`USE \`learnsrinagar\`;`);

  // Create users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert a test user (email: test@test.com, password: test)
  const testEmail = 'test@test.com';
  const testPassword = 'test';
  const hash = await bcrypt.hash(testPassword, 10);

  // Upsert test user (avoid duplicate on re‑run)
  await connection.query(
    `INSERT INTO users (email, password_hash)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);`,
    [testEmail, hash]
  );

  console.log('Database initialization complete. Test user created/updated.');
  await connection.end();
}

main().catch(err => {
  console.error('Error during DB setup:', err);
  process.exit(1);
});
