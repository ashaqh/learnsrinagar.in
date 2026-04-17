import { json } from "@remix-run/node"
import { query } from "@/lib/db"

export async function loader({ request }) {
  try {
    const blogs = await query(`
      SELECT 
        b.id, b.title, b.short_desc, b.thumbnail_image, b.publish_date,
        bc.name as category_name,
        u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      ORDER BY b.publish_date DESC, b.created_at DESC
    `)
    
    const blogsWithImages = blogs.map(blog => {
      let thumbnailImage = null
      if (blog.thumbnail_image && Buffer.isBuffer(blog.thumbnail_image)) {
        thumbnailImage = `data:image/jpeg;base64,${blog.thumbnail_image.toString('base64')}`
      }
      return {
        ...blog,
        thumbnail_image: thumbnailImage
      }
    })

    const categories = await query('SELECT * FROM blog_categories ORDER BY name')
    
    return json({ success: true, blogs: blogsWithImages, categories })
  } catch (error) {
    console.error('Error loading blogs API:', error)
    return json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
