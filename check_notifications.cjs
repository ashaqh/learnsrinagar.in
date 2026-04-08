const mysql = require('mysql2/promise');
const path = require('path');

async function check() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Assuming default
    database: 'learn_srinagar' // Assuming this is the DB name
  });

  try {
    const [users] = await connection.execute('SELECT id, name, class_id FROM users');
    console.log('--- USERS ---');
    console.log(users);

    const [tokens] = await connection.execute('SELECT user_id, count(*) as count FROM device_tokens GROUP BY user_id');
    console.log('--- TOKENS ---');
    console.log(tokens);

    const [liveClasses] = await connection.execute('SELECT id, title, class_id, is_all_schools FROM live_classes ORDER BY id DESC LIMIT 5');
    console.log('--- RECENT LIVE CLASSES ---');
    console.log(liveClasses);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
