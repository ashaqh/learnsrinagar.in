
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'learnsrinagar',
    password: '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function checkRoles() {
  try {
    const [roles] = await pool.query('SELECT * FROM roles');
    console.log('Roles:', JSON.stringify(roles, null, 2));
    
    const [schools] = await pool.query('SELECT COUNT(*) as count FROM schools');
    console.log('Schools count:', schools[0].count);

    const [users] = await pool.query('SELECT u.id, u.name, u.email, u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id LIMIT 10');
    console.log('Sample Users with Roles:', JSON.stringify(users, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

checkRoles();
