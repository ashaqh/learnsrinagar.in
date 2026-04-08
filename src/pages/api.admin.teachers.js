import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from "bcryptjs"

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
  if (request.method === 'GET') {
    if (user.role_name !== 'super_admin' && user.role_name !== 'school_admin' && user.role_name !== 'teacher') {
      return json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
  } else {
    if (user.role_name !== 'super_admin' && user.role_name !== 'school_admin') {
      return json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    // Teachers (role_id = 4)
    const teachers = await query(
      `SELECT u.id, u.name, u.email, u.created_at, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.role_id = 4`
    )

    // All classes
    const classes = await query(
      `SELECT id, name FROM classes ORDER BY name`
    )

    // All subjects with their class information
    const subjects = await query(
      `SELECT s.id, s.name, sc.class_id, c.name AS class_name
       FROM subjects s
       JOIN subject_classes sc ON s.id = sc.subject_id
       JOIN classes c ON sc.class_id = c.id
       ORDER BY c.name, s.name`
    )

    // Current assignments
    const assignments = await query(
      `SELECT ta.id, ta.teacher_id, ta.subject_id, ta.class_id, 
              s.name as subject_name, 
              c.name as class_name
       FROM teacher_assignments ta
       JOIN subjects s ON ta.subject_id = s.id
       JOIN classes c ON ta.class_id = c.id
       ORDER BY ta.teacher_id, c.name, s.name`
    )

    return json({ 
      success: true, 
      data: { teachers, classes, subjects, assignments } 
    })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  if (user.role_name !== 'super_admin' && user.role_name !== 'school_admin') {
    return json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const method = request.method
  const data = await request.json()

  try {
    if (method === 'POST') {
      const { _action } = data

      if (_action === 'assign_subject') {
        const { teacher_id, subject_id, class_id } = data
        if (!teacher_id || !subject_id || !class_id) {
          return json({ success: false, message: 'Teacher, subject, and class are all required.' }, { status: 400 })
        }

        const existing = await query(
          `SELECT id FROM teacher_assignments WHERE teacher_id = ? AND subject_id = ? AND class_id = ?`,
          [teacher_id, subject_id, class_id]
        )
        if (existing.length > 0) {
          return json({ success: false, message: 'This subject is already assigned to this teacher for this class.' }, { status: 400 })
        }

        await query(
          `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id) VALUES (?, ?, ?)`,
          [teacher_id, subject_id, class_id]
        )
        return json({ success: true, message: 'Subject assigned successfully' })
      }

      // Default CREATE teacher
      const { name, email, password } = data
      const existing = await query(`SELECT id FROM users WHERE email = ?`, [email])
      if (existing.length > 0) {
        return json({ success: false, message: 'Email already exists' }, { status: 400 })
      }

      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(password, salt)
      await query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 4)`,
        [name, email, passwordHash]
      )
      return json({ success: true, message: 'Teacher created successfully' })
    }

    if (method === 'PUT') {
      const { id, name, email, password } = data
      const existing = await query(`SELECT id FROM users WHERE email = ? AND id != ?`, [email, id])
      if (existing.length > 0) {
        return json({ success: false, message: 'Email already exists' }, { status: 400 })
      }

      if (password) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)
        await query(
          `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
          [name, email, passwordHash, id]
        )
      } else {
        await query(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [name, email, id])
      }
      return json({ success: true, message: 'Teacher updated successfully' })
    }

    if (method === 'DELETE') {
      const { _action, id, assignment_id } = data

      if (_action === 'remove_assignment') {
        await query(`DELETE FROM teacher_assignments WHERE id = ?`, [assignment_id])
        return json({ success: true, message: 'Subject assignment removed successfully' })
      }

      // Default DELETE teacher
      await query(`DELETE FROM teacher_assignments WHERE teacher_id = ?`, [id])
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return json({ success: true, message: 'Teacher deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
