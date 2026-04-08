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
  const studentId = url.searchParams.get("studentId") || user.id

  try {
    if (user.role_name === 'teacher' || user.role_name === 'school_admin' || user.role_name === 'class_admin' || user.role_name === 'super_admin') {
      if (!classId) return json({ error: "classId is required" }, { status: 400 })
      
      const view = url.searchParams.get("view")
      const date = url.searchParams.get("date")
      
      // Return attendance records for a class on a specific date
      if (view === 'records' && date) {
        let sql = `
          SELECT sa.id, sa.student_id, sa.class_id, sa.date, sa.status, 
                 u.name as student_name
          FROM student_attendance sa
          JOIN users u ON sa.student_id = u.id
          WHERE sa.class_id = ? AND DATE(sa.date) = ?
        `
        const params = [classId, date]
        
        const attendance = await query(sql, params)
        return json({ success: true, attendance })
      }
      
      // Default: return students list for marking
      let sql = `
        SELECT u.id, u.name, sp.enrollment_no AS enrollment_number 
        FROM users u 
        JOIN student_profiles sp ON u.id = sp.user_id 
        WHERE sp.class_id = ?
      `
      const params = [classId]
      
      if (user.role_name === 'school_admin' || user.role_name === 'teacher' || user.role_name === 'class_admin') {
        if (user.school_id) {
          sql += " AND sp.schools_id = ?"
          params.push(user.school_id)
        }
      }

      const students = await query(sql, params)
      return json({ success: true, students })
    } else {
      const attendance = await query(
        `SELECT sa.*, c.name as class_name 
         FROM student_attendance sa 
         JOIN classes c ON sa.class_id = c.id 
         WHERE sa.student_id = ? 
         ORDER BY sa.date DESC`,
        [studentId]
      )
      return json({ success: true, attendance })
    }
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function action({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user || !['teacher', 'class_admin', 'school_admin'].includes(user.role_name)) {
    return json({ error: "Unauthorized" }, { status: 403 })
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 })

  try {
    const { attendanceRecords, date, classId } = await request.json()
    
    for (const record of attendanceRecords) {
      await query(
        `INSERT INTO student_attendance (student_id, class_id, status, date) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE status = ?`,
        [record.studentId, classId, record.status, date, record.status]
      )
    }

    return json({ success: true, message: "Attendance updated successfully" })
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
