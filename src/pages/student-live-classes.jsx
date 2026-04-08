import { useEffect, useState } from 'react'
import { redirect, useLoaderData } from '@remix-run/react'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Clock, CheckCircle, ExternalLink, Search, Filter } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const getStatusBadge = (status) => {
  const statusConfig = {
    scheduled: { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Scheduled' },
    live: { color: 'bg-red-100 text-red-800', icon: Play, text: 'Live Now' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Completed' },
    cancelled: { color: 'bg-gray-100 text-gray-800', icon: Clock, text: 'Cancelled' }
  }
  
  const config = statusConfig[status] || statusConfig.scheduled
  const Icon = config.icon
  
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className='h-3 w-3' />
      {config.text}
    </Badge>
  )
}

const extractYouTubeVideoId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

const getYouTubeThumbnail = (url) => {
  const videoId = extractYouTubeVideoId(url)
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMzAgMTIwTDE3MCA5MEwxMzAgNjBWMTIwWiIgZmlsbD0iI0VGNDQ0NCIvPgo8L3N2Zz4K'
}

export async function loader({ request }) {
  const user = await getUser(request)
  if (!user) return redirect('/login')

  // Only students can access this page
  if (user.role_name !== 'student') {
    throw new Response('Access denied. Only students can view live classes.', { status: 403 })
  }

  // Get student's class information
  const studentProfile = await query(`
    SELECT class_id, schools_id 
    FROM student_profiles 
    WHERE user_id = ?
  `, [user.id])

  if (!studentProfile || studentProfile.length === 0) {
    throw new Response('Student profile not found', { status: 404 })
  }

  const classId = studentProfile[0].class_id
  const schoolId = studentProfile[0].schools_id

  // Get live classes for student's class and school (including all-school classes)
  const liveClasses = await query(`
    SELECT lc.*, 
           s.name as subject_name, 
           c.name as class_name, 
           u.name as teacher_name
    FROM live_classes lc
    LEFT JOIN subjects s ON lc.subject_id = s.id
    JOIN classes c ON lc.class_id = c.id
    JOIN users u ON lc.teacher_id = u.id
    WHERE lc.class_id = ? AND (lc.school_id = ? OR lc.is_all_schools = 1)
    ORDER BY 
      CASE 
        WHEN lc.status = 'live' THEN 1
        WHEN lc.status = 'scheduled' THEN 2
        WHEN lc.status = 'completed' THEN 3
        ELSE 4
      END,
      lc.start_time ASC,
      lc.created_at DESC
  `, [classId, schoolId])

  // Get all subjects for filter dropdown
  const subjects = await query('SELECT * FROM subjects ORDER BY name')

  // Get student's school name
  const schoolInfo = await query('SELECT name FROM schools WHERE id = ?', [schoolId])
  const schoolName = schoolInfo[0]?.name || 'Unknown School'

  return { liveClasses, subjects, user, classId, schoolId, schoolName }
}

export default function StudentLiveClasses() {
  const { liveClasses, subjects, user, schoolName } = useLoaderData()
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    subject: 'all',
    status: 'all',
    date: 'all'
  })

  const handleWatchLive = (liveClass) => {
    const videoId = extractYouTubeVideoId(liveClass.youtube_live_link)
    setSelectedVideo({ ...liveClass, videoId })
    setDialogOpen(true)
  }

  // Update statuses based on current time
  const updatedLiveClasses = liveClasses.map(lc => {
    if (!lc.start_time) return lc
    
    const now = new Date()
    const start = new Date(lc.start_time)
    const end = lc.end_time ? new Date(lc.end_time) : null
    
    let status = lc.status
    if (now < start) status = 'upcoming'
    else if (end && now > end) status = 'completed'
    else if (now >= start && (!end || now <= end)) status = 'live'
    
    return { ...lc, status }
  })

  // Filter live classes
  const filteredLiveClasses = updatedLiveClasses.filter(lc => {
    const matchesSearch = !filters.search || 
      lc.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      lc.topic_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      lc.teacher_name?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesSubject = filters.subject === 'all' || 
      lc.subject_id?.toString() === filters.subject
    
    const matchesStatus = filters.status === 'all' || lc.status === filters.status
    
    const matchesDate = filters.date === 'all' || (() => {
      if (!lc.start_time) return filters.date === 'all'
      const classDate = new Date(lc.start_time).toDateString()
      const today = new Date().toDateString()
      const tomorrow = new Date(Date.now() + 86400000).toDateString()
      
      switch (filters.date) {
        case 'today': return classDate === today
        case 'tomorrow': return classDate === tomorrow
        case 'this_week': {
          const weekFromNow = new Date(Date.now() + 7 * 86400000)
          return new Date(lc.start_time) <= weekFromNow
        }
        default: return true
      }
    })()
    
    return matchesSearch && matchesSubject && matchesStatus && matchesDate
  })

  const liveSessions = filteredLiveClasses.filter(lc => lc.status === 'live')
  const upcomingSessions = filteredLiveClasses.filter(lc => lc.status === 'upcoming' || lc.status === 'scheduled')
  const completedSessions = filteredLiveClasses.filter(lc => lc.status === 'completed')

  return (
    <div className='container mx-auto p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold'>Live Classes</h1>
        <p className='text-muted-foreground'>
          {schoolName} - Watch live lectures and access recorded sessions
        </p>
      </div>

      {/* Filters */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='text-lg flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filter Classes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='relative'>
              <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search lectures...'
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className='pl-8'
              />
            </div>
            
            <Select value={filters.subject} onValueChange={(value) => setFilters(prev => ({ ...prev, subject: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='All Subjects' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id.toString()}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='All Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='live'>Live Now</SelectItem>
                <SelectItem value='upcoming'>Upcoming</SelectItem>
                <SelectItem value='completed'>Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.date} onValueChange={(value) => setFilters(prev => ({ ...prev, date: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='All Dates' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Dates</SelectItem>
                <SelectItem value='today'>Today</SelectItem>
                <SelectItem value='tomorrow'>Tomorrow</SelectItem>
                <SelectItem value='this_week'>This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Live Now Section */}
      {liveSessions.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-2xl font-semibold mb-4 text-red-600 flex items-center gap-2'>
            <Play className='h-6 w-6' />
            Live Now
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {liveSessions.map((liveClass) => (
              <Card key={liveClass.id} className='overflow-hidden border-red-200 bg-red-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]'>
                <div className='relative aspect-video'>
                  <img 
                    src={getYouTubeThumbnail(liveClass.youtube_live_link)} 
                    alt={liveClass.title}
                    className='w-full h-full object-cover'
                    onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMzAgMTIwTDE3MCA5MEwxMzAgNjBWMTIwWiIgZmlsbD0iI0VGNDQ0NCIvPgo8L3N2Zz4K' }}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/20 to-transparent' />
                  <div className='absolute top-3 left-3'>
                    <div className='bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 animate-pulse'>
                      <div className='w-2 h-2 bg-white rounded-full'></div>
                      LIVE
                    </div>
                  </div>
                </div>
                <div className='p-4'>
                  <h3 className='font-bold text-lg mb-1 line-clamp-2'>{liveClass.title}</h3>
                  <p className='text-gray-600 text-sm mb-3 line-clamp-1'>{liveClass.topic_name}</p>
                  
                  <div className='space-y-2 text-sm text-gray-700 mb-4'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>Teacher:</span> 
                      <span>{liveClass.teacher_name}</span>
                    </div>
                    {liveClass.subject_name && (
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>Subject:</span> 
                        <span>{liveClass.subject_name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className='flex flex-col gap-2'>
                    {liveClass.zoom_link ? (
                      <>
                        <Button 
                          className='w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200'
                          onClick={() => window.open(liveClass.zoom_link, '_blank')}
                        >
                          <ExternalLink className='mr-2 h-5 w-5' />
                          Join Zoom Class
                        </Button>
                        <Button 
                          variant='outline'
                          className='w-full border-red-600 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-lg transition-colors duration-200'
                          onClick={() => handleWatchLive(liveClass)}
                        >
                          <Play className='mr-2 h-5 w-5' />
                          Watch on YouTube
                        </Button>
                      </>
                    ) : (
                      <Button 
                        className='w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200'
                        onClick={() => handleWatchLive(liveClass)}
                      >
                        <Play className='mr-2 h-5 w-5' />
                        Join Live Session
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-2xl font-semibold mb-4 flex items-center gap-2'>
            <Clock className='h-6 w-6' />
            Upcoming Sessions
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {upcomingSessions.map((liveClass) => (
              <Card key={liveClass.id} className='overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]'>
                <div className='relative aspect-video'>
                  <img 
                    src={getYouTubeThumbnail(liveClass.youtube_live_link)} 
                    alt={liveClass.title}
                    className='w-full h-full object-cover'
                    onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMzAgMTIwTDE3MCA5MEwxMzAgNjBWMTIwWiIgZmlsbD0iI0VGNDQ0NCIvPgo8L3N2Zz4K' }}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/10 to-transparent' />
                  <div className='absolute top-3 right-3'>
                    {getStatusBadge(liveClass.status)}
                  </div>
                </div>
                <div className='p-4'>
                  <h3 className='font-bold text-lg mb-1 line-clamp-2'>{liveClass.title}</h3>
                  <p className='text-gray-600 text-sm mb-3 line-clamp-1'>{liveClass.topic_name}</p>
                  
                  <div className='space-y-2 text-sm text-gray-700 mb-4'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>Teacher:</span> 
                      <span>{liveClass.teacher_name}</span>
                    </div>
                    {liveClass.subject_name && (
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>Subject:</span> 
                        <span>{liveClass.subject_name}</span>
                      </div>
                    )}
                    {liveClass.start_time && (
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>Starts:</span> 
                        <span className='text-blue-600 font-medium'>{new Date(liveClass.start_time).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className='flex flex-col gap-2 mt-auto'>
                    {liveClass.zoom_link ? (
                      <>
                        <Button 
                          variant='outline'
                          className='w-full border-blue-200 hover:bg-blue-50 text-blue-700 transition-colors duration-200'
                          onClick={() => window.open(liveClass.zoom_link, '_blank')}
                        >
                          <ExternalLink className='mr-2 h-4 w-4' />
                          Join Zoom (Starts Soon)
                        </Button>
                        <Button 
                          variant='ghost' 
                          className='w-full text-red-600 hover:bg-red-50 transition-colors duration-200'
                          onClick={() => handleWatchLive(liveClass)}
                        >
                          <Play className='mr-2 h-4 w-4' />
                          Watch on YouTube
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant='outline' 
                        className='w-full border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200'
                        onClick={() => handleWatchLive(liveClass)}
                      >
                        <Clock className='mr-2 h-4 w-4' />
                        Preview Session
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-2xl font-semibold mb-4 flex items-center gap-2'>
            <CheckCircle className='h-6 w-6' />
            Completed Sessions
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {completedSessions.map((liveClass) => (
              <Card key={liveClass.id} className='overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 bg-gray-50'>
                <div className='relative aspect-video'>
                  <img 
                    src={getYouTubeThumbnail(liveClass.youtube_live_link)} 
                    alt={liveClass.title}
                    className='w-full h-full object-cover opacity-80'
                    onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMzAgMTIwTDE3MCA5MEwxMzAgNjBWMTIwWiIgZmlsbD0iI0VGNDQ0NCIvPgo8L3N2Zz4K' }}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/20 to-transparent' />
                  <div className='absolute top-3 right-3'>
                    {getStatusBadge(liveClass.status)}
                  </div>
                </div>
                <div className='p-4'>
                  <h3 className='font-bold text-lg mb-1 line-clamp-2 text-gray-800'>{liveClass.title}</h3>
                  <p className='text-gray-600 text-sm mb-3 line-clamp-1'>{liveClass.topic_name}</p>
                  
                  <div className='space-y-2 text-sm text-gray-700 mb-4'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>Teacher:</span> 
                      <span>{liveClass.teacher_name}</span>
                    </div>
                    {liveClass.subject_name && (
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>Subject:</span> 
                        <span>{liveClass.subject_name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className='flex flex-col gap-2 mt-auto'>
                    <Button 
                      variant='outline' 
                      className='w-full border-green-200 hover:bg-green-50 hover:border-green-300 transition-colors duration-200'
                      onClick={() => handleWatchLive(liveClass)}
                    >
                      <Play className='mr-2 h-4 w-4' />
                      Watch on YouTube
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Sessions Message */}
      {filteredLiveClasses.length === 0 && liveClasses.length > 0 && (
        <Card>
          <CardContent className='text-center py-12'>
            <Filter className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Classes Match Your Filters</h3>
            <p className='text-muted-foreground'>
              Try adjusting your filters to see more live classes.
            </p>
          </CardContent>
        </Card>
      )}
      
      {liveClasses.length === 0 && (
        <Card>
          <CardContent className='text-center py-12'>
            <Clock className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Live Classes Available</h3>
            <p className='text-muted-foreground'>
              There are currently no live classes scheduled for your class. Check back later!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Video Player Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedVideo(null); }}>
        <DialogContent className='max-w-4xl max-h-[90vh]'>
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
            <DialogDescription>
              {selectedVideo?.topic_name} — {selectedVideo?.teacher_name}
              {selectedVideo?.subject_name && ` • ${selectedVideo.subject_name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedVideo && (
            <div className='space-y-4'>
              <div className='aspect-video rounded-lg overflow-hidden bg-black'>
                {selectedVideo.videoId ? (
                  <iframe
                    width='100%'
                    height='100%'
                    src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1`}
                    title={selectedVideo.title}
                    frameBorder='0'
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                    allowFullScreen
                    className='rounded-lg'
                  ></iframe>
                ) : (
                  <div className='flex flex-col items-center justify-center h-full text-white'>
                    <Play className='h-16 w-16 mb-4 opacity-60' />
                    <p className='text-sm opacity-60 mb-4'>Unable to embed this video</p>
                    <Button
                      className='bg-red-600 hover:bg-red-700'
                      onClick={() => window.open(selectedVideo.youtube_live_link, '_blank')}
                    >
                      <ExternalLink className='mr-2 h-4 w-4' />
                      Open on YouTube
                    </Button>
                  </div>
                )}
              </div>
              <div className='flex items-center justify-between text-sm text-muted-foreground'>
                <div className='flex items-center gap-4'>
                  {selectedVideo.start_time && (
                    <span>📅 {new Date(selectedVideo.start_time).toLocaleString()}</span>
                  )}
                  {selectedVideo.status && getStatusBadge(selectedVideo.status)}
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => window.open(selectedVideo.youtube_live_link, '_blank')}
                >
                  <ExternalLink className='mr-2 h-3 w-3' />
                  Open in YouTube
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}