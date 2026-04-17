const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'learnsrinagar'
  });
  
  try {
    console.log('--- Testing Live Classes API Logic ---');
    
    // Test the updated teachers query
    const [teachers] = await connection.query(`
      SELECT u.id, u.name, u.email, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE r.name = "teacher" 
      ORDER BY u.name
    `);
    console.log('Success! Teachers count:', teachers.length);
    if (teachers.length > 0) {
      console.log('First teacher data:', JSON.stringify(teachers[0], null, 2));
      if (teachers[0].role_name === 'teacher' && teachers[0].email) {
        console.log('Verification PASSED: teacher has role_name and email');
      } else {
        console.log('Verification FAILED: teacher is missing role_name or email');
      }
    }

    // Test the live classes query (super_admin version)
    const [liveClasses] = await connection.query(`
      SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
      FROM live_classes lc
      LEFT JOIN subjects s ON lc.subject_id = s.id
      JOIN classes c ON lc.class_id = c.id
      JOIN users u ON lc.teacher_id = u.id
      LEFT JOIN schools sch ON lc.school_id = sch.id
      ORDER BY lc.start_time DESC
    `);
    console.log('Success! Live Classes count:', liveClasses.length);
    if (liveClasses.length > 0) {
       console.log('First live class data:', JSON.stringify(liveClasses[0], null, 2));
    }

  } catch (e) {
    console.error('Verification failed:', e);
  } finally {
    await connection.end();
  }
}

test();
