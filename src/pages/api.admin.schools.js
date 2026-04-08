import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"

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

  try {
    const schools = await query(`
      SELECT s.*, u.name as admin_name, u.email as admin_email
      FROM schools s
      LEFT JOIN users u ON s.users_id = u.id
      ORDER BY s.name ASC
    `)
    return json({ success: true, schools })
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
      const { name, address, users_id } = data
      await query(
        `INSERT INTO schools (name, address, users_id) VALUES (?, ?, ?)`,
        [name, address, users_id]
      )
      return json({ success: true, message: 'School created successfully' })
    }

    if (method === 'PUT') {
      const { id, name, address, users_id } = data
      await query(
        `UPDATE schools SET name = ?, address = ?, users_id = ? WHERE id = ?`,
        [name, address, users_id, id]
      )
      return json({ success: true, message: 'School updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      // Check for dependencies if necessary (e.g. classes)
      await query('DELETE FROM schools WHERE id = ?', [id])
      return json({ success: true, message: 'School deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin School API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
