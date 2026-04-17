import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import { classesTableSupportsSchoolId } from "@/services/classQuery.server"

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || !['super_admin', 'school_admin', 'teacher', 'class_admin'].includes(user.role_name)) return null
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  try {
    let sql = `SELECT * FROM classes`
    const params = []

    sql += ` ORDER BY name ASC`
    const classes = await query(sql, params)
    return json({ success: true, classes })
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
      const { name } = data
      const school_id = user.role_name === 'school_admin' ? user.school_id : (data.school_id || null)
      
      if (!name) return json({ success: false, message: 'Name is required' }, { status: 400 })

      if (await classesTableSupportsSchoolId()) {
        await query(`INSERT INTO classes (name, school_id) VALUES (?, ?)`, [name, school_id])
      } else {
        await query(`INSERT INTO classes (name) VALUES (?)`, [name])
      }

      return json({ success: true, message: 'Class created successfully' })
    }

    if (method === 'PUT') {
      const { id, name } = data
      await query(`UPDATE classes SET name = ? WHERE id = ?`, [name, id])
      return json({ success: true, message: 'Class updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await query('DELETE FROM classes WHERE id = ?', [id])
      return json({ success: true, message: 'Class deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin Class API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
