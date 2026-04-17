import { query } from './src/lib/db.js';

async function test() {
  try {
    const results = await query(`
      SELECT s.id, s.name, 
             JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', c.name)) as classes
      FROM subjects s
      LEFT JOIN subject_classes sc ON s.id = sc.subject_id
      LEFT JOIN classes c ON sc.class_id = c.id
      GROUP BY s.id
      LIMIT 1
    `);
    console.log('Results:', JSON.stringify(results, null, 2));
    console.log('Type of classes:', typeof results[0].classes);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}

test();
