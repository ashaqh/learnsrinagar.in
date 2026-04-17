import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import { notificationService } from "@/services/notificationService.server"
import { getLiveClassNotification } from "@/services/notificationHelper.server"
import {
  calculateLiveClassStatus,
  formatLiveClassDateTimeForDb,
  normalizeLiveClassRecords,
} from "@/lib/liveClassDateTime"

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const authorizedRoles = ['super_admin', 'school_admin', 'class_admin', 'teacher']
  if (!authorizedRoles.includes(user.role_name)) {
    return json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  try {
    const schools = await query('SELECT id, name FROM schools ORDER BY name')
    const classes = await query('SELECT id, name FROM classes ORDER BY name')
    const subjects = await query('SELECT id, name FROM subjects ORDER BY name')
    const teachers = await query(`
      SELECT u.id, u.name, u.email, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE r.name = "teacher" 
      ORDER BY u.name
    `)
    
    let liveClasses = []
    if (user.role_name === 'super_admin') {
      liveClasses = await query(`
        SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
        FROM live_classes lc
        LEFT JOIN subjects s ON lc.subject_id = s.id
        JOIN classes c ON lc.class_id = c.id
        JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN schools sch ON lc.school_id = sch.id
        ORDER BY lc.start_time DESC
      `)
    } else if (user.role_name === 'school_admin' || user.role_name === 'class_admin') {
      liveClasses = await query(`
        SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
        FROM live_classes lc
        LEFT JOIN subjects s ON lc.subject_id = s.id
        JOIN classes c ON lc.class_id = c.id
        JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN schools sch ON lc.school_id = sch.id
        WHERE lc.school_id = ? OR lc.is_all_schools = 1
        ORDER BY lc.start_time DESC
      `, [user.school_id])
    } else if (user.role_name === 'teacher') {
      liveClasses = await query(`
        SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
        FROM live_classes lc
        LEFT JOIN subjects s ON lc.subject_id = s.id
        JOIN classes c ON lc.class_id = c.id
        JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN schools sch ON lc.school_id = sch.id
        WHERE lc.teacher_id = ?
        ORDER BY lc.start_time DESC
      `, [user.id])
    }

    return json({
      success: true,
      data: {
        liveClasses: normalizeLiveClassRecords(liveClasses),
        schools,
        classes,
        subjects,
        teachers,
      },
    })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  if (user.role_name === 'teacher') {
    return json(
      { success: false, message: 'You have view-only access to live classes' },
      { status: 403 }
    )
  }

  const method = request.method
  const data = await request.json()

  try {
    if (method === 'POST') {
      const { title, youtube_live_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, is_all_schools, start_time, end_time } = data
      
      const normalizedStartTime = formatLiveClassDateTimeForDb(start_time)
      const normalizedEndTime = formatLiveClassDateTimeForDb(end_time)
      const status = calculateLiveClassStatus(normalizedStartTime, normalizedEndTime)

      await query(
        `INSERT INTO live_classes (title, youtube_live_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, is_all_schools, start_time, end_time, status, created_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          youtube_live_link,
          session_type,
          topic_name,
          subject_id,
          class_id,
          teacher_id || user.id,
          school_id,
          is_all_schools ? 1 : 0,
          normalizedStartTime,
          normalizedEndTime,
          status,
          user.role_name,
        ]
      )

      // Trigger Notification
      try {
        const notificationMessage = await getLiveClassNotification({
          topic_name,
          class_id,
          teacher_id: teacher_id || user.id,
          start_time: normalizedStartTime,
        });

        await notificationService.sendNotification({
          title: "New Live Class Scheduled",
          message: notificationMessage,
          eventType: 'CLASS_SCHEDULED',
          targetType: is_all_schools ? 'all' : 'group',
          targetId: is_all_schools ? null : class_id,
          audienceContext: is_all_schools ? null : { schoolId: school_id },
          metadata: { topic: topic_name, startTime: normalizedStartTime, title: title }
        });
      } catch (notifyError) {
        console.error('Failed to send live class notification:', notifyError);
      }

      return json({ success: true, message: 'Live class created successfully' })
    }

    if (method === 'PUT') {
      const { id, title, youtube_live_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, is_all_schools, start_time, end_time } = data
      
      const normalizedStartTime = formatLiveClassDateTimeForDb(start_time)
      const normalizedEndTime = formatLiveClassDateTimeForDb(end_time)
      const status = calculateLiveClassStatus(normalizedStartTime, normalizedEndTime)

      await query(
        `UPDATE live_classes 
         SET title = ?, youtube_live_link = ?, session_type = ?, topic_name = ?, subject_id = ?, class_id = ?, teacher_id = ?, school_id = ?, is_all_schools = ?, start_time = ?, end_time = ?, status = ?
         WHERE id = ?`,
        [
          title,
          youtube_live_link,
          session_type,
          topic_name,
          subject_id,
          class_id,
          teacher_id,
          school_id,
          is_all_schools ? 1 : 0,
          normalizedStartTime,
          normalizedEndTime,
          status,
          id,
        ]
      )
      return json({ success: true, message: 'Live class updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await query('DELETE FROM live_classes WHERE id = ?', [id])
      return json({ success: true, message: 'Live class deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
