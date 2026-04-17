import mysql from 'mysql2/promise';

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

  console.log('Update complete.');
  process.exit(0);
}
main();
