const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function verifyTimetable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'learnsrinagar'
  });

  try {
    // Check for a specific class ID. Let's find one in the database.
    const [classes] = await connection.execute('SELECT DISTINCT class_id FROM live_classes LIMIT 1');
    if (classes.length === 0) {
      console.log('No live classes found in database.');
      return;
    }
    const classId = classes[0].class_id;
    console.log(`Checking timetable for Class ID: ${classId}`);

    const [rows] = await connection.execute(`
      SELECT z.id,
             IFNULL(s.name, z.topic_name) as subject_name,
             u.name as teacher_name,
             DAYNAME(z.start_time) as day_of_week,
             TIME_FORMAT(z.start_time, '%H:%i:%s') as start_time,
             TIME_FORMAT(z.end_time, '%H:%i:%s') as end_time,
             z.session_type
      FROM live_classes z
      LEFT JOIN subjects s ON z.subject_id = s.id
      JOIN users u ON z.teacher_id = u.id
      WHERE z.class_id = ?
      ORDER BY FIELD(DAYNAME(z.start_time), 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), z.start_time
    `, [classId]);

    console.log('Timetable results:', JSON.stringify(rows, null, 2));
    
    const otherTopics = rows.filter(r => r.session_type === 'other_topic');
    console.log(`Found ${otherTopics.length} Other Topic sessions.`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

verifyTimetable();
