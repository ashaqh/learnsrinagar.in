import { useState } from 'react'
import { useLoaderData, Form, useActionData, useNavigation } from '@remix-run/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Eye, Calendar, User, FileText } from 'lucide-react'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function loader({ request }) {
  const user = await getUser(request)
  if (!user || (user.role_name !== 'super_admin' && user.role_name !== 'school_admin')) {
    throw new Response('Unauthorized', { status: 403 })
  }

  try {
    // Fetch all blogs with category and author info
    const blogs = await db.query(`
      SELECT 
        b.id, b.title, b.category_id, b.author_id, b.short_desc, b.content, 
        b.publish_date, b.created_at,
        bc.name as category_name,
        u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC
    `)

    // Fetch categories
    const categories = await db.query('SELECT * FROM blog_categories ORDER BY name')
    
    // Transform blob buffers to base64 strings
    const transformedBlogs = blogs.map(blog => {
      const transformed = { ...blog }
      if (blog.thumbnail_image instanceof Buffer) {
        transformed.thumbnail_image = `data:image/jpeg;base64,${blog.thumbnail_image.toString('base64')}`
      }
      if (blog.cover_image instanceof Buffer) {
        transformed.cover_image = `data:image/jpeg;base64,${blog.cover_image.toString('base64')}`
      }
      return transformed
    })

    console.log('Loaded blogs:', blogs.length)
    console.log('Loaded categories:', categories.length)

    return new Response(JSON.stringify({ blogs: transformedBlogs, categories, user }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error loading blog management data:', error)
    return new Response(JSON.stringify({ blogs: [], categories: [], user }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  }
}

export async function action({ request }) {
  const user = await getUser(request)
  if (!user || (user.role_name !== 'super_admin' && user.role_name !== 'school_admin')) {
    throw new Response('Unauthorized', { status: 403 })
  }

  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create' || action === 'update') {
      const thumbnailFile = formData.get('thumbnail_image')
      const coverFile = formData.get('cover_image')
      
      let thumbnailBuffer = null
      let coverBuffer = null
      
      if (thumbnailFile && thumbnailFile.size > 0) {
        thumbnailBuffer = Buffer.from(await thumbnailFile.arrayBuffer())
      }
      
      if (coverFile && coverFile.size > 0) {
        coverBuffer = Buffer.from(await coverFile.arrayBuffer())
      }
      
      const blogData = {
        title: formData.get('title'),
        category_id: parseInt(formData.get('category_id')),
        short_desc: formData.get('short_desc'),
        content: formData.get('content'),
        thumbnail_image: thumbnailBuffer,
        cover_image: coverBuffer,
        publish_date: formData.get('publish_date')
      }

      if (action === 'create') {
        await db.query(`
          INSERT INTO blogs (title, category_id, author_id, short_desc, content, thumbnail_image, cover_image, publish_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          blogData.title,
          blogData.category_id,
          user.id,
          blogData.short_desc,
          blogData.content,
          blogData.thumbnail_image,
          blogData.cover_image,
          blogData.publish_date
        ])

        try {
          const { notificationService } = await import("@/services/notificationService.server");
          const { getBlogNotification } = await import("@/services/notificationHelper.server");
          const message = await getBlogNotification(blogData.title, blogData.category_id, user.id);

          await notificationService.sendNotification({
            title: "New Blog Published!",
            message: message,
            eventType: 'BLOG_POSTED',
            targetType: 'all',
            metadata: { blogTitle: blogData.title }
          });
        } catch (notifyError) {
          console.error('Failed to send blog notification from dashboard:', notifyError);
        }

        return { success: true, message: 'Blog created successfully!' }
      } else {
        const blogId = formData.get('blog_id')
        const updateFields = []
        const updateValues = []
        
        updateFields.push('title = ?', 'category_id = ?', 'short_desc = ?', 'content = ?', 'publish_date = ?')
        updateValues.push(blogData.title, blogData.category_id, blogData.short_desc, blogData.content, blogData.publish_date)
        
        if (blogData.thumbnail_image) {
          updateFields.push('thumbnail_image = ?')
          updateValues.push(blogData.thumbnail_image)
        }
        
        if (blogData.cover_image) {
          updateFields.push('cover_image = ?')
          updateValues.push(blogData.cover_image)
        }
        
        updateValues.push(blogId)
        
        await db.query(`UPDATE blogs SET ${updateFields.join(', ')} WHERE id = ?`, updateValues)
        return { success: true, message: 'Blog updated successfully!' }
      }
    }

    if (action === 'delete') {
      const blogId = formData.get('blog_id')
      await db.query('DELETE FROM blogs WHERE id = ?', [blogId])
      return { success: true, message: 'Blog deleted successfully!' }
    }

    if (action === 'create_category') {
      const name = formData.get('category_name')
      const description = formData.get('category_description')
      await db.query('INSERT INTO blog_categories (name, description) VALUES (?, ?)', [name, description])
      return { success: true, message: 'Category created successfully!' }
    }

    if (action === 'update_category') {
      const categoryId = formData.get('category_id')
      const name = formData.get('category_name')
      const description = formData.get('category_description')
      await db.query('UPDATE blog_categories SET name = ?, description = ? WHERE id = ?', [name, description, categoryId])
      return { success: true, message: 'Category updated successfully!' }
    }

    if (action === 'delete_category') {
      const categoryId = formData.get('category_id')
      await db.query('DELETE FROM blog_categories WHERE id = ?', [categoryId])
      return { success: true, message: 'Category deleted successfully!' }
    }

  } catch (error) {
    console.error('Error in blog action:', error)
    return { success: false, message: 'An error occurred. Please try again.' }
  }
}

export default function ManageBlogs() {
  const { blogs, categories, user } = useLoaderData()
  const actionData = useActionData()
  const navigation = useNavigation()
  const [editingBlog, setEditingBlog] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const isSubmitting = navigation.state === 'submitting'

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status) => {
    const variants = {
      published: 'default',
      draft: 'secondary',
      archived: 'outline'
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  const BlogForm = ({ blog = null, onClose }) => (
    <Form method="post" encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="_action" value={blog ? 'update' : 'create'} />
      {blog && <input type="hidden" name="blog_id" value={blog.id} />}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            defaultValue={blog?.title}
            required
            placeholder="Enter blog title"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="category_id">Category *</Label>
          <Select name="category_id" defaultValue={blog?.category_id?.toString()} required>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="short_desc">Short Description</Label>
        <Textarea
          id="short_desc"
          name="short_desc"
          defaultValue={blog?.short_desc}
          placeholder="Brief description for blog cards (150 characters max)"
          maxLength={150}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={blog?.content}
          required
          placeholder="Full blog content (HTML supported)"
          rows={8}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="thumbnail_image">Thumbnail Image</Label>
          <Input
            id="thumbnail_image"
            name="thumbnail_image"
            type="file"
            accept="image/*"
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">For blog card display (recommended: 400x300px)</p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cover_image">Cover Image</Label>
          <Input
            id="cover_image"
            name="cover_image"
            type="file"
            accept="image/*"
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">For blog detail page (recommended: 1200x600px)</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="publish_date">Publish Date *</Label>
        <Input
          id="publish_date"
          name="publish_date"
          type="date"
          defaultValue={blog?.publish_date}
          required
        />
      </div>
      
      <input type="hidden" name="status" value="published" />
      <input type="hidden" name="audience" value="all" />
      <input type="hidden" name="comments_enabled" value="off" />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (blog ? 'Update Blog' : 'Create Blog')}
        </Button>
      </DialogFooter>
    </Form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Management</h1>
          <p className="text-muted-foreground">Create and manage blog posts for Learn Srinagar</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Category</DialogTitle>
                <DialogDescription>
                  Add a new blog category for organizing posts
                </DialogDescription>
              </DialogHeader>
              <Form method="post" className="space-y-4" onSubmit={() => setShowCategoryDialog(false)}>
                <input type="hidden" name="_action" value="create_category" />
                <div className="space-y-2">
                  <Label htmlFor="category_name">Category Name *</Label>
                  <Input
                    id="category_name"
                    name="category_name"
                    required
                    placeholder="e.g., School Events"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category_description">Description</Label>
                  <Textarea
                    id="category_description"
                    name="category_description"
                    placeholder="Brief description of this category"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    Create Category
                  </Button>
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Blog
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Blog Post</DialogTitle>
                <DialogDescription>
                  Create a new blog post for the Learn Srinagar community
                </DialogDescription>
              </DialogHeader>
              <BlogForm onClose={() => setShowCreateDialog(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {actionData?.message && (
        <div className={`p-4 rounded-lg ${actionData.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {actionData.message}
        </div>
      )}

      <Tabs defaultValue="blogs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="blogs">All Blogs ({blogs.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="blogs">
          <Card>
            <CardHeader>
              <CardTitle>Blog Posts</CardTitle>
              <CardDescription>
                Manage all blog posts in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Publish Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map(blog => (
                    <TableRow key={blog.id}>
                      <TableCell className="font-medium">{blog.title}</TableCell>
                      <TableCell>{blog.category_name}</TableCell>
                      <TableCell>{blog.author_name}</TableCell>
                      <TableCell>{formatDate(blog.publish_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {blog.status === 'published' && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/blog/${blog.id}`} target="_blank">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setEditingBlog(blog)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Blog Post</DialogTitle>
                                <DialogDescription>
                                  Update the blog post details
                                </DialogDescription>
                              </DialogHeader>
                              <BlogForm blog={editingBlog} onClose={() => setEditingBlog(null)} />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{blog.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Form method="post">
                                  <input type="hidden" name="_action" value="delete" />
                                  <input type="hidden" name="blog_id" value={blog.id} />
                                  <Button type="submit" variant="destructive">Delete</Button>
                                </Form>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Blog Categories</CardTitle>
              <CardDescription>
                Manage blog categories for organizing posts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                  <Card key={category.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {blogs.filter(blog => blog.category_id === category.id).length} posts
                        </span>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setEditingCategory(category)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Category</DialogTitle>
                                <DialogDescription>Update category details</DialogDescription>
                              </DialogHeader>
                              <Form method="post" className="space-y-4" onSubmit={() => setEditingCategory(null)}>
                                <input type="hidden" name="_action" value="update_category" />
                                <input type="hidden" name="category_id" value={editingCategory?.id} />
                                <div className="space-y-2">
                                  <Label htmlFor="edit_category_name">Category Name *</Label>
                                  <Input id="edit_category_name" name="category_name" defaultValue={editingCategory?.name} required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit_category_description">Description</Label>
                                  <Textarea id="edit_category_description" name="category_description" defaultValue={editingCategory?.description} />
                                </div>
                                <DialogFooter>
                                  <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                                  <Button type="submit" disabled={isSubmitting}>Update</Button>
                                </DialogFooter>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{category.name}"? This will affect all blogs in this category.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Form method="post">
                                  <input type="hidden" name="_action" value="delete_category" />
                                  <input type="hidden" name="category_id" value={category.id} />
                                  <Button type="submit" variant="destructive">Delete</Button>
                                </Form>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}