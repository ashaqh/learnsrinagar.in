
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

async function checkSchools() {
  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM schools');
    console.log('Schools Columns:', JSON.stringify(columns, null, 2));
    
    const [schools] = await pool.query('SELECT * FROM schools');
    console.log('Schools Data:', JSON.stringify(schools, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

checkSchools();
