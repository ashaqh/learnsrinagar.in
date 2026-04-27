import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import { notificationService } from "@/services/notificationService.server"
import { getBlogNotification } from "@/services/notificationHelper.server"

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || (user.role_name !== 'super_admin' && user.role_name !== 'school_admin')) return null
  return user
}

export async function loader({ request }) {
// ... (omitting loader content for brevity in replace_file_content if I'm not changing it, but wait, I need to keep the whole block if I'm replacing from line 1)
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  try {
    const rawBlogs = await query(`
      SELECT b.*, bc.name as category_name, u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC
    `)

    const blogs = rawBlogs.map(blog => {
      const transformed = { ...blog }
      if (blog.thumbnail_image instanceof Buffer) {
        transformed.thumbnail_image = `data:image/jpeg;base64,${blog.thumbnail_image.toString('base64')}`
      } else if (blog.thumbnail_image && typeof blog.thumbnail_image === 'object' && blog.thumbnail_image.type === 'Buffer') {
        // Handle cases where it's already serialized as a Buffer object
        transformed.thumbnail_image = `data:image/jpeg;base64,${Buffer.from(blog.thumbnail_image.data).toString('base64')}`
      }

      if (blog.cover_image instanceof Buffer) {
        transformed.cover_image = `data:image/jpeg;base64,${blog.cover_image.toString('base64')}`
      } else if (blog.cover_image && typeof blog.cover_image === 'object' && blog.cover_image.type === 'Buffer') {
        transformed.cover_image = `data:image/jpeg;base64,${Buffer.from(blog.cover_image.data).toString('base64')}`
      }
      return transformed
    })

    return json({ success: true, blogs })
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
      const { title, category_id, short_desc, content, thumbnail_image, cover_image, publish_date } = data
      
      let thumbBuffer = null
      let coverBuffer = null
      if (thumbnail_image) thumbBuffer = Buffer.from(thumbnail_image.split(',').pop() || thumbnail_image, 'base64')
      if (cover_image) coverBuffer = Buffer.from(cover_image.split(',').pop() || cover_image, 'base64')

      await query(
        `INSERT INTO blogs (title, category_id, author_id, short_desc, content, thumbnail_image, cover_image, publish_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, category_id, user.id, short_desc, content, thumbBuffer, coverBuffer, publish_date]
      )

      // Trigger Notification
      let notificationResult = null;
      try {
        const message = await getBlogNotification(title, category_id, user.id);

        notificationResult = await notificationService.sendNotification({
          title: "New Blog Published!",
          message: message,
          eventType: 'BLOG_POSTED',
          targetType: 'all',
          metadata: { blogTitle: title }
        });
        if (notificationResult?.warning) {
          console.warn('[AdminBlogs API] Notification warning:', notificationResult.warning, notificationResult.pushDelivery);
        }
      } catch (notifyError) {
        console.error('Failed to send blog notification:', notifyError);
      }

      return json({
        success: true,
        message: 'Blog created successfully',
        notificationStatus: notificationResult?.pushDeliveryStatus ?? null,
        notificationWarning: notificationResult?.warning ?? null,
      })
    }

    if (method === 'PUT') {
      const { id, title, category_id, short_desc, content, thumbnail_image, cover_image, publish_date } = data
      
      const updateFields = ['title = ?', 'category_id = ?', 'short_desc = ?', 'content = ?', 'publish_date = ?']
      const values = [title, category_id, short_desc, content, publish_date]

      if (thumbnail_image && !thumbnail_image.startsWith('http')) {
        updateFields.push('thumbnail_image = ?')
        values.push(Buffer.from(thumbnail_image.split(',').pop(), 'base64'))
      }
      if (cover_image && !cover_image.startsWith('http')) {
        updateFields.push('cover_image = ?')
        values.push(Buffer.from(cover_image.split(',').pop(), 'base64'))
      }

      values.push(id)
      await query(`UPDATE blogs SET ${updateFields.join(', ')} WHERE id = ?`, values)
      return json({ success: true, message: 'Blog updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await query('DELETE FROM blogs WHERE id = ?', [id])
      return json({ success: true, message: 'Blog deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin Blog API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
