import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || (user.role_name !== 'super_admin' && user.role_name !== 'school_admin')) return null
  return user
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  try {
    const categories = await query('SELECT * FROM blog_categories ORDER BY name')
    return json({ success: true, categories })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const method = request.method
  const data = await request.json()

  try {
    if (method === 'POST') {
      const { name, description } = data
      await query('INSERT INTO blog_categories (name, description) VALUES (?, ?)', [name, description])
      return json({ success: true, message: 'Category created successfully' })
    }

    if (method === 'PUT') {
      const { id, name, description } = data
      await query('UPDATE blog_categories SET name = ?, description = ? WHERE id = ?', [name, description, id])
      return json({ success: true, message: 'Category updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await query('DELETE FROM blog_categories WHERE id = ?', [id])
      return json({ success: true, message: 'Category deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
