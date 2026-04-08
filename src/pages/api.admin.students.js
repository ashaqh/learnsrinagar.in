import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from 'bcryptjs'

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || !['super_admin', 'school_admin', 'class_admin'].includes(user.role_name)) return null
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const classId = url.searchParams.get('classId')
  const schoolId = url.searchParams.get('schoolId') || user.school_id

  try {
    let sql = `
      SELECT u.id, u.name, u.email, u.created_at,
             sp.id AS profile_id,
             sp.enrollment_no, sp.date_of_birth,
             sp.class_id, sp.schools_id,
             c.name AS class_name,
             s.name AS school_name
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN classes c          ON sp.class_id   = c.id
      LEFT JOIN schools s          ON sp.schools_id = s.id
      WHERE u.role_id = 5
    `
    const params = []

    if (user.role_name === 'school_admin' || schoolId) {
      sql += ` AND sp.schools_id = ?`
      params.push(schoolId || user.school_id)
    }

    if (classId) {
      sql += ` AND sp.class_id = ?`
      params.push(classId)
    } else if (user.class_ids && user.class_ids.length > 0 && user.role_name === 'class_admin') {
      sql += ` AND sp.class_id IN (${user.class_ids.map(() => '?').join(',')})`
      params.push(...user.class_ids)
    }

    sql += ` ORDER BY u.name ASC`

    const students = await query(sql, params)

    // Get parent links
    const links = await query(
      `SELECT psl.id, psl.parent_id, psl.student_id, p.name AS parent_name, p.email AS parent_email
       FROM parent_student_links psl
       JOIN users p ON psl.parent_id = p.id`
    )

    const studentParentLinks = {}
    links.forEach((ln) => {
      if (!studentParentLinks[ln.student_id]) studentParentLinks[ln.student_id] = []
      studentParentLinks[ln.student_id].push({
        id: ln.id,
        parent_id: ln.parent_id,
        parent_name: ln.parent_name,
        parent_email: ln.parent_email,
      })
    })

    return json({ success: true, students, studentParentLinks })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const method = request.method
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (method === 'POST') {
      const { name, email, password, enrollment_no, date_of_birth, class_id } = data
      const schools_id = user.school_id || data.schools_id

      // Duplicate checks
      const dupEmail = await query('SELECT id FROM users WHERE email = ?', [email])
      if (dupEmail.length > 0) return json({ success: false, message: 'Email already exists' }, { status: 400 })

      const dupEnroll = await query('SELECT id FROM student_profiles WHERE enrollment_no = ?', [enrollment_no])
      if (dupEnroll.length > 0) return json({ success: false, message: 'Enrollment number already exists' }, { status: 400 })

      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(password, salt)

      const userRes = await query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 5)`,
        [name, email, passwordHash]
      )

      const studentId = userRes.insertId
      await query(
        `INSERT INTO student_profiles (user_id, class_id, schools_id, enrollment_no, date_of_birth) 
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, class_id, schools_id, enrollment_no, date_of_birth]
      )

      return json({ success: true, message: 'Student created successfully', studentId })
    }

    if (method === 'PUT') {
      const { id, profile_id, name, email, password, enrollment_no, date_of_birth, class_id } = data
      const schools_id = user.school_id || data.schools_id

      // Update User
      if (password) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)
        await query(`UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`, [name, email, passwordHash, id])
      } else {
        await query(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [name, email, id])
      }

      // Update Profile
      if (profile_id) {
        await query(
          `UPDATE student_profiles SET class_id = ?, schools_id = ?, enrollment_no = ?, date_of_birth = ? WHERE id = ?`,
          [class_id, schools_id, enrollment_no, date_of_birth, profile_id]
        )
      } else {
        await query(
          `INSERT INTO student_profiles (user_id, class_id, schools_id, enrollment_no, date_of_birth) VALUES (?, ?, ?, ?, ?)`,
          [id, class_id, schools_id, enrollment_no, date_of_birth]
        )
      }

      return json({ success: true, message: 'Student updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await query(`DELETE FROM parent_student_links WHERE student_id = ?`, [id])
      await query(`DELETE FROM student_profiles WHERE user_id = ?`, [id])
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return json({ success: true, message: 'Student deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
