const { query } = require('./src/lib/db');
async function run() {
    try {
        console.log('Testing INSERT INTO live_classes without end_time...');
        // Mock data similar to what mobile sends
        const data = {
            title: 'Test Live Class',
            youtube_live_link: 'https://youtube.com/live/test',
            session_type: 'scheduled',
            topic_name: 'Test Topic',
            subject_id: 1,
            class_id: 1,
            teacher_id: 1,
            school_id: 1,
            is_all_schools: 0,
            start_time: '2026-03-28 21:00:00',
            // end_time: undefined // Missing
        };

        const result = await query(
            `INSERT INTO live_classes (title, youtube_live_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, is_all_schools, start_time, end_time, created_by_role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.title, data.youtube_live_link, data.session_type, data.topic_name, data.subject_id, data.class_id, data.teacher_id, data.school_id, data.is_all_schools ? 1 : 0, data.start_time, undefined, 'super_admin']
        );
        console.log('Success:', result);
    } catch (err) {
        console.error('Failed as expected or unexpected error:', err.message);
    }
    process.exit(0);
}
run();
