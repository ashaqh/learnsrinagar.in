import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"

export async function loader({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user) {
    return json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const url = new URL(request.url)
  const classId = url.searchParams.get("classId")

  try {
    let liveClasses;
    
    // Default for students: show classes for their class and school
    if (user.role_name === 'student') {
      const studentProfile = await query("SELECT class_id, schools_id FROM student_profiles WHERE user_id = ?", [user.id])
      if (studentProfile.length > 0) {
        liveClasses = await query(
          `SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name 
           FROM live_classes lc 
           LEFT JOIN subjects s ON lc.subject_id = s.id 
           JOIN classes c ON lc.class_id = c.id
           JOIN users u ON lc.teacher_id = u.id 
           WHERE lc.class_id = ? AND (lc.school_id = ? OR lc.is_all_schools = 1)
           ORDER BY 
             CASE 
               WHEN lc.status = 'live' THEN 1
               WHEN lc.status = 'scheduled' THEN 2
               WHEN lc.status = 'completed' THEN 3
               ELSE 4
             END,
             lc.start_time ASC,
             lc.created_at DESC`,
          [studentProfile[0].class_id, studentProfile[0].schools_id]
        )
      }
    } else if (classId) {
      liveClasses = await query(
        `SELECT lc.*, s.name as subject_name, u.name as teacher_name 
         FROM live_classes lc 
         LEFT JOIN subjects s ON lc.subject_id = s.id 
         JOIN users u ON lc.teacher_id = u.id 
         WHERE lc.class_id = ?
         ORDER BY lc.start_time ASC`,
        [classId]
      )
    } else if (user.role_name === 'teacher') {
      liveClasses = await query(
        `SELECT lc.*, s.name as subject_name 
         FROM live_classes lc 
         LEFT JOIN subjects s ON lc.subject_id = s.id 
         WHERE lc.teacher_id = ?
         ORDER BY lc.start_time ASC`,
        [user.id]
      )
    }

    return json({ liveClasses: liveClasses || [] })
  } catch (error) {
    console.error("Error in api.live_classes.js:", error);
    return json({ error: "Internal server error", message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user || !['teacher', 'school_admin'].includes(user.role_name)) {
    return json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const { classId, subjectId, title, youtubeUrl, startTime, endTime } = await request.json()
    
    await query(
      `INSERT INTO live_classes (class_id, subject_id, teacher_id, title, youtube_url, start_time, end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [classId, subjectId, user.id, title, youtubeUrl, startTime, endTime]
    )

    return json({ success: true, message: "Live class scheduled successfully" })
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
