import { useLoaderData, Link } from '@remix-run/react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, User, Eye, ArrowLeft, Share2, Download } from 'lucide-react'
import { db } from '@/lib/db'

export async function loader({ params }) {
  try {
    const blogId = params.id

    // Fetch blog with category and author info
    const [blog] = await db.query(`
      SELECT 
        b.*,
        bc.name as category_name,
        u.name as author_name,
        u.email as author_email
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      WHERE b.id = ?
    `, [blogId])
    
    if (blog) {
      // Convert image buffers to base64
      if (blog.thumbnail_image && Buffer.isBuffer(blog.thumbnail_image)) {
        blog.thumbnail_image = `data:image/jpeg;base64,${blog.thumbnail_image.toString('base64')}`
      } else {
        blog.thumbnail_image = null
      }
      
      if (blog.cover_image && Buffer.isBuffer(blog.cover_image)) {
        blog.cover_image = `data:image/jpeg;base64,${blog.cover_image.toString('base64')}`
      } else {
        blog.cover_image = null
      }
    }

    if (!blog) {
      throw new Response('Blog not found', { status: 404 })
    }

    // Fetch related blogs from same category
    const relatedBlogs = await db.query(`
      SELECT 
        b.id, b.title, b.short_desc, b.thumbnail_image, b.publish_date,
        bc.name as category_name,
        u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      WHERE b.category_id = ? AND b.id != ?
      ORDER BY b.publish_date DESC
      LIMIT 3
    `, [blog.category_id, blogId])
    
    // Convert related blog images to base64
    const relatedBlogsWithImages = relatedBlogs.map(relatedBlog => {
      let thumbnailImage = null
      if (relatedBlog.thumbnail_image && Buffer.isBuffer(relatedBlog.thumbnail_image)) {
        thumbnailImage = `data:image/jpeg;base64,${relatedBlog.thumbnail_image.toString('base64')}`
      }
      return {
        ...relatedBlog,
        thumbnail_image: thumbnailImage
      }
    })

    return new Response(JSON.stringify({ blog, relatedBlogs: relatedBlogsWithImages }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error loading blog:', error)
    throw new Response('Blog not found', { status: 404 })
  }
}

export default function BlogDetail() {
  const { blog, relatedBlogs } = useLoaderData()

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: blog.title,
        text: blog.short_desc,
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      // You could add a toast notification here
    }
  }

  const attachments = blog.attachments ? JSON.parse(blog.attachments) : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <div className="mb-6">
        <Link to="/blogs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blogs
          </Button>
        </Link>
      </div>

      {/* Blog Header */}
      <div className="mb-8">
        {blog.cover_image && (
          <div className="aspect-video overflow-hidden rounded-lg mb-6">
            <img 
              src={blog.cover_image} 
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-4">
          <Badge variant="secondary" className="text-sm">
            {blog.category_name}
          </Badge>
          
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            {blog.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>By {blog.author_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(blog.publish_date)}</span>
            </div>

          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Blog Content */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />
        </CardContent>
      </Card>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <h3 className="text-lg font-semibold">Downloads & Attachments</h3>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{attachment.name}</p>
                      <p className="text-sm text-muted-foreground">{attachment.size}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={attachment.url} download>
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Blogs */}
      {relatedBlogs.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-6">Related Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedBlogs.map(relatedBlog => (
              <Card key={relatedBlog.id} className="group hover:shadow-lg transition-all duration-300">
                {relatedBlog.thumbnail_image && (
                  <div className="aspect-video overflow-hidden rounded-t-lg">
                    <img 
                      src={relatedBlog.thumbnail_image} 
                      alt={relatedBlog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                
                <CardContent className="p-4">
                  <Badge variant="secondary" className="text-xs mb-2">
                    {relatedBlog.category_name}
                  </Badge>
                  <h4 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {relatedBlog.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {relatedBlog.short_desc}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{relatedBlog.author_name}</span>
                    <span>{formatDate(relatedBlog.publish_date)}</span>
                  </div>
                  <Link to={`/blog/${relatedBlog.id}`} className="absolute inset-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}