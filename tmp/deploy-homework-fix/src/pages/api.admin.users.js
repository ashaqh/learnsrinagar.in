import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from 'bcryptjs'

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || user.role_name !== 'super_admin') return null
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const role_id = url.searchParams.get('role_id')

  try {
    let sql = `
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.role_id IN (2, 4)
    `
    const params = []
    if (role_id) {
      sql += ` AND u.role_id = ?`
      params.push(role_id)
    }
    sql += ` ORDER BY u.name ASC`

    const users = await query(sql, params)
    return json({ success: true, users })
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
      const { name, email, password, role_id } = data
      
      const existing = await query(`SELECT id FROM users WHERE email = ?`, [email])
      if (existing.length > 0) {
        return json({ success: false, message: 'Email already exists' }, { status: 400 })
      }

      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(password, salt)
      
      await query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
        [name, email, passwordHash, role_id]
      )
      return json({ success: true, message: 'User created successfully' })
    }

    if (method === 'PUT') {
      const { id, name, email, password, role_id } = data
      
      const updateFields = ['name = ?', 'email = ?', 'role_id = ?']
      const values = [name, email, role_id]

      if (password) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)
        updateFields.push('password_hash = ?')
        values.push(passwordHash)
      }

      values.push(id)
      await query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, values)
      return json({ success: true, message: 'User updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      // Check if user is linked to a school
      const links = await query(`SELECT id FROM schools WHERE users_id = ?`, [id])
      if (links.length > 0) {
        return json({ success: false, message: 'Cannot delete user. User is assigned as an admin to a school.' }, { status: 400 })
      }

      await query('DELETE FROM users WHERE id = ?', [id])
      return json({ success: true, message: 'User deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin User API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
