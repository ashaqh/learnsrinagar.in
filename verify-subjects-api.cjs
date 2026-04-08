const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'learnsrinagar'
  });
  
  try {
    // This replicates the logic I put in api.admin.subjects.js
    console.log('--- Testing New Query Logic ---');
    const [subjects] = await connection.query(`SELECT id, name, created_at FROM subjects ORDER BY name ASC`);
    const [subjectClasses] = await connection.query(`
      SELECT sc.subject_id, sc.class_id, c.name as class_name
      FROM subject_classes sc
      JOIN classes c ON sc.class_id = c.id
    `);

    const subjectClassMap = {};
    for (const sc of subjectClasses) {
      if (!subjectClassMap[sc.subject_id]) {
        subjectClassMap[sc.subject_id] = [];
      }
      subjectClassMap[sc.subject_id].push({
        id: sc.class_id,
        name: sc.class_name,
      });
    }

    const processedSubjects = subjects.map((subject) => ({
      ...subject,
      classes: subjectClassMap[subject.id] || [],
      class_names: (subjectClassMap[subject.id] || [])
        .map((c) => c.name)
        .join(', '),
    }));

    console.log('Success! Processed subjects count:', processedSubjects.length);
    if (processedSubjects.length > 0) {
      console.log('First subject with classes:', JSON.stringify(processedSubjects[0], null, 2));
    }
  } catch (e) {
    console.error('Verification failed:', e);
  } finally {
    await connection.end();
  }
}

test();
