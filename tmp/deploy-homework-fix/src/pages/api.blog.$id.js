import { json } from "@remix-run/node"
import { query } from "@/lib/db"

export async function loader({ params }) {
  try {
    const blogs = await query(`
      SELECT 
        b.*, 
        bc.name as category_name,
        u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `, [params.id])

    if (blogs.length === 0) {
      return json({ success: false, message: 'Blog not found' }, { status: 404 })
    }

    const blog = blogs[0];

    let coverImage = null
    if (blog.cover_image && Buffer.isBuffer(blog.cover_image)) {
      coverImage = `data:image/jpeg;base64,${blog.cover_image.toString('base64')}`
    }

    // Important: Prevent the raw buffer from being serialized which causes errors
    delete blog.thumbnail_image;
    delete blog.cover_image;

    return json({ 
      success: true, 
      blog: {
        ...blog,
        cover_image: coverImage
      }
    })
  } catch (error) {
    console.error('Error loading blog details API:', error)
    return json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
