import { useState } from 'react'
import { useLoaderData, Link } from '@remix-run/react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Calendar, User, Eye, ChevronRight, Search, Filter, GraduationCap, Users, Menu, Award, Zap, Globe, School, BookOpen } from 'lucide-react'
import { db } from '@/lib/db'

export async function loader() {
  try {
    // Fetch all blogs with category and author info
    const blogs = await db.query(`
      SELECT 
        b.id, b.title, b.short_desc, b.thumbnail_image, b.publish_date,
        bc.name as category_name,
        u.name as author_name
      FROM blogs b
      JOIN blog_categories bc ON b.category_id = bc.id
      JOIN users u ON b.author_id = u.id
      ORDER BY b.publish_date DESC, b.created_at DESC
    `)
    
    // Convert image buffers to base64 for frontend
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

    // Fetch categories for filter
    const categories = await db.query('SELECT * FROM blog_categories ORDER BY name')

    console.log('Public blogs loaded:', blogsWithImages.length)
    console.log('Categories loaded:', categories.length)
    
    return new Response(JSON.stringify({ blogs: blogsWithImages, categories }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error loading blogs:', error)
    return new Response(JSON.stringify({ blogs: [], categories: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  }
}

export default function Blogs() {
  const { blogs, categories } = useLoaderData()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Filter and sort blogs
  const filteredBlogs = blogs
    .filter(blog => {
      const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           blog.short_desc?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || blog.category_name === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.publish_date) - new Date(a.publish_date)
      if (sortBy === 'oldest') return new Date(a.publish_date) - new Date(b.publish_date)
      if (sortBy === 'popular') return b.views - a.views
      return 0
    })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className='flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/20'>
      {/* Header - Same as Home Page */}
      <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm'>
        <div className='container mx-auto flex h-16 items-center justify-between px-4 lg:px-6'>
          <Link to='/' className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg'>
              <GraduationCap className='h-5 w-5' />
            </div>
            <div className='flex flex-col'>
              <span className='text-xl font-bold leading-none'>Learn Srinagar</span>
              <span className='text-xs text-muted-foreground'>Transforming Education</span>
            </div>
          </Link>
          <nav className='hidden md:flex items-center gap-8'>
            <Link to='/#impact' className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'>
              Impact
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </Link>
            <Link to='/#features' className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'>
              Features
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </Link>
            <Link to='/#mission' className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'>
              Mission
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </Link>
            <Link to='/#schools' className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'>
              Schools
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </Link>
            <Link to='/blogs' className='relative text-base font-semibold text-primary transition-all duration-300 hover:scale-110 group'>
              Blog
              <span className='absolute -bottom-1 left-0 w-full h-0.5 bg-primary'></span>
            </Link>
          </nav>
          <div className='flex items-center gap-3'>
            <Link to='/login' className='hidden sm:block'>
              <Button size='sm' className='shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'>
                <Users className='mr-2 h-4 w-4' />
                Login
              </Button>
            </Link>
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant='ghost' size='sm' className='md:hidden'>
                  <Menu className='h-5 w-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='right' className='w-80'>
                <div className='flex flex-col gap-6 mt-6'>
                  <div className='flex items-center gap-3 pb-4 border-b'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                      <GraduationCap className='h-5 w-5' />
                    </div>
                    <div>
                      <span className='text-lg font-bold'>Learn Srinagar</span>
                      <p className='text-xs text-muted-foreground'>Transforming Education</p>
                    </div>
                  </div>
                  
                  <nav className='flex flex-col gap-4'>
                    <Link to='/#impact' className='flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors' onClick={() => setMobileMenuOpen(false)}>
                      <Award className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Impact</span>
                    </Link>
                    <Link to='/#features' className='flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors' onClick={() => setMobileMenuOpen(false)}>
                      <Zap className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Features</span>
                    </Link>
                    <Link to='/#mission' className='flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors' onClick={() => setMobileMenuOpen(false)}>
                      <Globe className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Mission</span>
                    </Link>
                    <Link to='/#schools' className='flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors' onClick={() => setMobileMenuOpen(false)}>
                      <School className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Schools</span>
                    </Link>
                    <Link to='/blogs' className='flex items-center gap-3 p-3 rounded-lg bg-primary/10 transition-colors' onClick={() => setMobileMenuOpen(false)}>
                      <BookOpen className='h-5 w-5 text-primary' />
                      <span className='font-medium text-primary'>Blog</span>
                    </Link>
                  </nav>
                  
                  <div className='mt-auto pt-6 border-t'>
                    <Link to='/login' onClick={() => setMobileMenuOpen(false)}>
                      <Button className='w-full'>
                        <Users className='mr-2 h-4 w-4' />
                        Login to Portal
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1'>
        <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Learn Srinagar Blog</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Stay updated with the latest news, achievements, and educational content from our school network
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 p-6 bg-muted/30 rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Showing {filteredBlogs.length} of {blogs.length} blog posts
        </p>
      </div>

      {/* Blog Grid */}
      {filteredBlogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map(blog => (
            <Card key={blog.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              {blog.thumbnail_image && (
                <div className="aspect-video overflow-hidden rounded-t-lg">
                  <img 
                    src={blog.thumbnail_image} 
                    alt={blog.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              
              <CardHeader className="pb-3">
                <div className="mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {blog.category_name}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                  {blog.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="pb-3">
                <CardDescription className="text-sm line-clamp-3">
                  {blog.short_desc}
                </CardDescription>
              </CardContent>

              <CardFooter className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {blog.author_name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(blog.publish_date)}
                  </div>
                </div>
                <Link to={`/blog/${blog.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Read More
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No blog posts found</p>
            <p className="text-sm">Try adjusting your search or filter criteria</p>
          </div>
        </div>
      )}

        {/* Load More Button (for future pagination) */}
        {filteredBlogs.length > 0 && (
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Posts
            </Button>
          </div>
        )}
        </div>
      </main>

      {/* Footer - Same as Home Page */}
      <footer className='w-full border-t bg-muted/30 py-12'>
        <div className='container mx-auto px-4 md:px-6'>
          <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4'>
            <div className='space-y-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                  <GraduationCap className='h-5 w-5' />
                </div>
                <div>
                  <div className='font-bold text-lg'>Learn Srinagar</div>
                  <div className='text-xs text-muted-foreground'>Transforming Education</div>
                </div>
              </div>
              <p className='text-sm text-muted-foreground max-w-xs'>
                Transforming education across Kashmir through innovative hybrid learning solutions.
              </p>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Quick Links</h4>
              <div className='space-y-2 text-sm'>
                <Link to='/#features' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Features
                </Link>
                <Link to='/#mission' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Our Mission
                </Link>
                <Link to='/blogs' className='block text-primary font-medium transition-colors'>
                  Blog
                </Link>
                <Link to='/#schools' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Partner Schools
                </Link>
                <Link to='/login' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Login Portal
                </Link>
              </div>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Education</h4>
              <div className='space-y-2 text-sm'>
                <div className='text-muted-foreground'>Classes 6-8</div>
                <div className='text-muted-foreground'>Live Interactive Sessions</div>
                <div className='text-muted-foreground'>Digital Resources</div>
                <div className='text-muted-foreground'>Expert Teachers</div>
              </div>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Contact Info</h4>
              <div className='space-y-2 text-sm text-muted-foreground'>
                <div>Srinagar, Kashmir</div>
                <div>Education Department</div>
                <div>learnsrinagar.in</div>
              </div>
            </div>
          </div>
          
          <div className='border-t mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <p className='text-sm text-muted-foreground'>
                © {new Date().getFullYear()} Learn Srinagar. All rights reserved.
              </p>
            </div>
            <div className='flex items-center gap-4 text-sm text-muted-foreground'>
              <span>Empowering Kashmir's Future</span>
              <div className='w-2 h-2 bg-primary rounded-full animate-pulse'></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}