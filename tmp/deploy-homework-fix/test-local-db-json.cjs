const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'learnsrinagar'
  });
  
  try {
    const [subjects] = await connection.query('SELECT * FROM subjects');
    console.log('Total subjects:', subjects.length);
    console.log('First subject:', JSON.stringify(subjects[0], null, 2));
    
    const [jsonRes] = await connection.query(`
      SELECT s.id, s.name, 
             JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', c.name)) as classes
      FROM subjects s
      LEFT JOIN subject_classes sc ON s.id = sc.subject_id
      LEFT JOIN classes c ON sc.class_id = c.id
      GROUP BY s.id
      LIMIT 1
    `);
    console.log('JSON query result classes type:', typeof jsonRes[0].classes);
    console.log('JSON query result classes value:', jsonRes[0].classes);
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}

test();
