import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from 'bcryptjs'

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || !['super_admin', 'school_admin'].includes(user.role_name)) return null
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const school_id = url.searchParams.get('school_id') || user.school_id

  try {
    // For school_admin, ensure they only see their own school
    let sql = `
      SELECT ca.id,
             ca.admin_id,
             ca.school_id,
             ca.class_id,
             ca.assigned_at,
             u.name       AS admin_name,
             u.email      AS admin_email,
             s.name       AS school_name,
             c.name       AS class_name
      FROM class_admins ca
      JOIN users u   ON ca.admin_id  = u.id
      JOIN schools s ON ca.school_id = s.id
      JOIN classes c ON ca.class_id  = c.id
      WHERE 1=1
    `
    const params = []

    if (user.role_name === 'school_admin') {
      sql += " AND ca.school_id = ?"
      params.push(user.school_id)
    } else if (school_id) {
       sql += " AND ca.school_id = ?"
       params.push(school_id)
    }

    const classAdmins = await query(sql, params)
    
    // Also fetch classes and schools for dropdowns if needed
    const classes = await query('SELECT id, name FROM classes ORDER BY name')
    const schools = await query('SELECT id, name FROM schools ORDER BY name')

    return json({ success: true, classAdmins, classes, schools })
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
      const { name, email, password, class_id } = data
      const school_id = user.role_name === 'school_admin' ? user.school_id : data.school_id

      if (!name || !email || !password || !school_id || !class_id) {
        return json({ success: false, message: 'Missing required fields' }, { status: 400 })
      }

      // Check if user exists
      const exists = await query('SELECT id FROM users WHERE email = ?', [email])
      if (exists.length > 0) {
        return json({ success: false, message: 'A user with this email already exists.' }, { status: 400 })
      }

      // Start transaction
      await query('START TRANSACTION')

      try {
        const salt = await bcrypt.genSalt(10)
        const password_hash = await bcrypt.hash(password, salt)
        const result = await query(
          'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 3)',
          [name, email, password_hash]
        )

        const admin_id = result.insertId

        await query(
          'INSERT INTO class_admins (admin_id, school_id, class_id) VALUES (?, ?, ?)',
          [admin_id, school_id, class_id]
        )

        await query('COMMIT')
        return json({ success: true, message: 'Class admin created and assigned successfully' })
      } catch (err) {
        await query('ROLLBACK')
        throw err
      }
    }

    if (method === 'PUT') {
      const { id, admin_id, name, email, password, class_id } = data
      const school_id = user.role_name === 'school_admin' ? user.school_id : data.school_id

      if (!id || !admin_id || !name || !email || !school_id || !class_id) {
        return json({ success: false, message: 'Missing required fields' }, { status: 400 })
      }

      // Check for email conflicts
      const emailExists = await query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, admin_id]
      )

      if (emailExists.length > 0) {
        return json({ success: false, message: 'A user with this email already exists.' }, { status: 400 })
      }

      // Start transaction
      await query('START TRANSACTION')

      try {
        if (password && password.trim() !== '') {
          const salt = await bcrypt.genSalt(10)
          const password_hash = await bcrypt.hash(password, salt)
          await query(
            `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
            [name, email, password_hash, admin_id]
          )
        } else {
          await query(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [name, email, admin_id])
        }

        // Update assignment
        await query(
          `UPDATE class_admins SET school_id = ?, class_id = ? WHERE id = ?`,
          [school_id, class_id, id]
        )

        await query('COMMIT')
        return json({ success: true, message: 'Class admin updated successfully' })
      } catch (err) {
        await query('ROLLBACK')
        throw err
      }
    }

    if (method === 'DELETE') {
      const { id, admin_id } = data
      if (!id) return json({ success: false, message: 'Missing ID' }, { status: 400 })

      // Start transaction
      await query('START TRANSACTION')
      try {
        await query('DELETE FROM class_admins WHERE id = ?', [id])
        // If we also want to delete the user:
        if (admin_id) {
          await query('DELETE FROM users WHERE id = ?', [admin_id])
        }
        await query('COMMIT')
        return json({ success: true, message: 'Class admin deleted successfully' })
      } catch (err) {
        await query('ROLLBACK')
        throw err
      }
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin Class Admin API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
