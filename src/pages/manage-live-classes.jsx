import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'

import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, ExternalLink, Play, Clock, CheckCircle, Filter, Search } from 'lucide-react'

const getStatusBadge = (status) => {
  const statusConfig = {
    upcoming: { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Upcoming' },
    live: { color: 'bg-red-100 text-red-800', icon: Play, text: 'Live' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Completed' },
    cancelled: { color: 'bg-gray-100 text-gray-800', icon: Clock, text: 'Cancelled' }
  }
  
  const config = statusConfig[status] || statusConfig.upcoming
  const Icon = config.icon
  
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className='h-3 w-3' />
      {config.text}
    </Badge>
  )
}

const calculateStatus = (startTime, endTime) => {
  if (!startTime) return 'upcoming'
  
  const now = new Date()
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null
  
  if (now < start) return 'upcoming'
  if (end && now > end) return 'completed'
  if (now >= start && (!end || now <= end)) return 'live'
  
  return 'upcoming'
}

export async function loader({ request }) {
  const user = await getUser(request)
  if (!user) return redirect('/login')

  const authorizedRoles = ['super_admin', 'school_admin', 'class_admin', 'teacher']
  if (!authorizedRoles.includes(user.role_name)) {
    throw new Response('Access denied', { status: 403 })
  }

  let classes = []
  let subjects = []
  let teachers = []
  let liveClasses = []
  let schools = []

  if (user.role_name === 'super_admin') {
    const schoolsResult = await query('SELECT * FROM schools ORDER BY name')
    const classesResult = await query('SELECT * FROM classes ORDER BY name')
    const subjectsResult = await query('SELECT * FROM subjects ORDER BY name')
    const teachersResult = await query(
      'SELECT id, name FROM users WHERE role_id = 4 ORDER BY name'
    )
    
    const liveClassesResult = await query(`
      SELECT 
        lc.*,
        s.name as subject_name,
        c.name as class_name,
        u.name as teacher_name,
        CASE 
          WHEN lc.is_all_schools = 1 THEN 'All Schools'
          ELSE sch.name 
        END as school_names,
        CASE 
          WHEN lc.is_all_schools = 1 THEN (SELECT COUNT(*) FROM schools)
          ELSE 1 
        END as school_count
      FROM live_classes lc
      LEFT JOIN subjects s ON lc.subject_id = s.id
      JOIN classes c ON lc.class_id = c.id
      JOIN users u ON lc.teacher_id = u.id
      LEFT JOIN schools sch ON lc.school_id = sch.id
      ORDER BY lc.created_at DESC
    `)

    schools = schoolsResult
    classes = classesResult
    subjects = subjectsResult
    teachers = teachersResult
    liveClasses = liveClassesResult
  } else if (user.role_name === 'school_admin' || user.role_name === 'class_admin') {
    let schoolId = user.school_id;
    let schoolsResult = [];
    if (!schoolId && user.role_name === 'school_admin') {
      schoolsResult = await query('SELECT * FROM schools WHERE users_id = ?', [user.id])
      schoolId = schoolsResult[0]?.id
    } else if (schoolId) {
      schoolsResult = await query('SELECT * FROM schools WHERE id = ?', [schoolId])
    }
    
    if (schoolId) {
      const classesResult = await query('SELECT * FROM classes ORDER BY name')
      const subjectsResult = await query('SELECT * FROM subjects ORDER BY name')
      const teachersResult = await query(
        'SELECT id, name FROM users WHERE role_id = 4 ORDER BY name'
      )
      const liveClassesResult = await query(`
        SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name,
          CASE WHEN lc.is_all_schools = 1 THEN 'All Schools' ELSE sch.name END as school_names
        FROM live_classes lc
        LEFT JOIN subjects s ON lc.subject_id = s.id
        JOIN classes c ON lc.class_id = c.id
        JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN schools sch ON lc.school_id = sch.id
        WHERE lc.school_id = ? OR lc.is_all_schools = 1
        ORDER BY lc.created_at DESC
      `, [schoolId])

      schools = schoolsResult
      classes = classesResult
      subjects = subjectsResult
      teachers = teachersResult
      liveClasses = liveClassesResult.map(lc => ({ ...lc, school_count: lc.is_all_schools ? 2 : 1, school_ids: schoolId.toString() }))
    }
  } else if (user.role_name === 'teacher') {
    const classesResult = await query(`
      SELECT DISTINCT c.id, c.name
      FROM classes c
      JOIN teacher_assignments ta ON c.id = ta.class_id
      WHERE ta.teacher_id = ?
      ORDER BY c.name
    `, [user.id])

    const subjectsResult = await query(`
      SELECT DISTINCT s.id, s.name
      FROM subjects s
      JOIN teacher_assignments ta ON s.id = ta.subject_id
      WHERE ta.teacher_id = ?
      ORDER BY s.name
    `, [user.id])

    const liveClassesResult = await query(`
      SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_names
      FROM live_classes lc
      LEFT JOIN subjects s ON lc.subject_id = s.id
      JOIN classes c ON lc.class_id = c.id
      JOIN users u ON lc.teacher_id = u.id
      JOIN schools sch ON lc.school_id = sch.id
      WHERE lc.teacher_id = ?
      ORDER BY lc.created_at DESC
    `, [user.id])

    classes = classesResult
    subjects = subjectsResult
    teachers = [{ id: user.id, name: user.name }]
    liveClasses = liveClassesResult.map(lc => ({ ...lc, school_count: 1, school_ids: lc.school_id?.toString() }))
  }

  return { classes, subjects, teachers, liveClasses, schools, user }
}

export async function action({ request }) {
  const user = await getUser(request)
  if (!user) return redirect('/login')

  // Teachers and admins have view-only access on this screen.
  if (
    user.role_name === 'teacher' ||
    user.role_name === 'school_admin' ||
    user.role_name === 'class_admin'
  ) {
    return { success: false, message: 'You have view-only access to live classes' }
  }

  const formData = await request.formData()
  const intent = formData.get('intent')

  try {
    if (intent === 'create') {
      const title = formData.get('title')
      const youtube_live_link = formData.get('youtube_live_link')
      const session_type = formData.get('session_type')
      const topic_name = formData.get('topic_name')
      const subject_id = formData.get('subject_id') || null
      const class_id = formData.get('class_id')
      const teacher_id = formData.get('teacher_id') || user.id
      const school_id = formData.get('school_id')
      const start_time = formData.get('start_time')
      const end_time = formData.get('end_time')
      
      const zoom_link = formData.get('zoom_link')
      
      if (!start_time || !end_time) {
        return {
          success: false,
          message: 'Start Time and End Time are mandatory fields',
        }
      }
      
      const status = calculateStatus(start_time, end_time)
      
      let created_by_role = 'teacher'
      if (user.role_name === 'super_admin') created_by_role = 'super_admin'
      else if (user.role_name === 'school_admin') created_by_role = 'school_admin'

      const is_all_schools = school_id === 'all' && user.role_name === 'super_admin'
      const final_school_id = is_all_schools ? null : school_id
      
      await query(
        `INSERT INTO live_classes (title, youtube_live_link, zoom_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, is_all_schools, start_time, end_time, status, created_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, youtube_live_link, zoom_link, session_type, topic_name, subject_id, class_id, teacher_id, final_school_id, is_all_schools, start_time, end_time, status, created_by_role]
      )

      // Trigger Notification
        try {
          const { notificationService } = await import("@/services/notificationService.server");
          const { getLiveClassNotification } = await import("@/services/notificationHelper.server");
        
        const notificationMessage = await getLiveClassNotification({
          topic_name,
          class_id,
          teacher_id: teacher_id || user.id,
          start_time
        });

        await notificationService.sendNotification({
          title: "New Live Class Scheduled",
          message: notificationMessage,
          eventType: 'CLASS_SCHEDULED',
          targetType: is_all_schools ? 'all' : 'group',
          targetId: is_all_schools ? null : class_id,
          metadata: { topic: topic_name, startTime: start_time, title: title, zoomLink: zoom_link }
        });
      } catch (notifyError) {
        console.error('Failed to send live class notification:', notifyError);
      }

      return {
        success: true,
        message: school_id === 'all' ? 'Live class created for all schools successfully' : 'Live class created successfully',
      }
    } else if (intent === 'update') {
      const id = formData.get('id')
      const title = formData.get('title')
      const youtube_live_link = formData.get('youtube_live_link')
      const session_type = formData.get('session_type')
      const topic_name = formData.get('topic_name')
      const subject_id = formData.get('subject_id') || null
      const class_id = formData.get('class_id')
      const start_time = formData.get('start_time')
      const end_time = formData.get('end_time')
      
      const zoom_link = formData.get('zoom_link')
      
      if (!start_time || !end_time) {
        return {
          success: false,
          message: 'Start Time and End Time are mandatory fields',
        }
      }
      
      const status = calculateStatus(start_time, end_time)

      await query(
        `UPDATE live_classes
         SET title = ?, youtube_live_link = ?, zoom_link = ?, session_type = ?, topic_name = ?, subject_id = ?, class_id = ?, start_time = ?, end_time = ?, status = ?
         WHERE id = ?`,
        [title, youtube_live_link, zoom_link, session_type, topic_name, subject_id, class_id, start_time, end_time, status, id]
      )

      return {
        success: true,
        message: 'Live class updated successfully',
      }
    } else if (intent === 'delete') {
      const id = formData.get('id')
      await query('DELETE FROM live_classes WHERE id = ?', [id])

      return {
        success: true,
        message: 'Live class deleted successfully',
      }
    }
  } catch (error) {
    console.error('Live class action error:', error)
    return {
      success: false,
      message: 'An error occurred while processing your request',
    }
  }

  return null
}

export default function ManageLiveClasses() {
  const { classes, subjects, teachers, liveClasses, schools, user } = useLoaderData()
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  // Teachers and admins get read-only access
  const isReadOnly =
    user.role_name === 'teacher' ||
    user.role_name === 'school_admin' ||
    user.role_name === 'class_admin'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedClass, setSelectedClass] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [sessionType, setSessionType] = useState('subject_specific')

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    school: 'all',
    teacher: 'all',
    class: 'all',
    date: 'all'
  })

  const [zoomLink, setZoomLink] = useState('')

  // Permanent Zoom links for 6th, 7th, 8th
  const permanentZoomLinks = {
    '6': 'https://zoom.us/j/6th_class_link',
    '7': 'https://zoom.us/j/7th_class_link',
    '8': 'https://zoom.us/j/8th_class_link'
  }

  const handleClassChange = (classId) => {
    const className = classes.find(c => c.id.toString() === classId)?.name
    if (className && permanentZoomLinks[className]) {
      setZoomLink(permanentZoomLinks[className])
    }
  }

  useEffect(() => {
    if (selectedClass) {
      setZoomLink(selectedClass.zoom_link || '')
    } else {
      setZoomLink('')
    }
  }, [selectedClass])

  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.message)
      setDialogOpen(false)
      setSelectedClass(null)
    } else if (actionData?.success === false) {
      toast.error(actionData.message)
    }
  }, [actionData])

  // Update statuses based on current time
  const liveClassesWithUpdatedStatus = liveClasses.map(lc => ({
    ...lc,
    status: calculateStatus(lc.start_time, lc.end_time)
  }))

  // Filter live classes
  const filteredLiveClasses = liveClassesWithUpdatedStatus.filter(lc => {
    const matchesSearch = !filters.search || 
      lc.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      lc.topic_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      lc.teacher_name?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesStatus = filters.status === 'all' || lc.status === filters.status
    
    const matchesSchool = filters.school === 'all' || 
      (lc.school_ids && lc.school_ids.includes(filters.school))
    
    const matchesTeacher = filters.teacher === 'all' || 
      lc.teacher_id?.toString() === filters.teacher
    
    const matchesClass = filters.class === 'all' || 
      lc.class_id?.toString() === filters.class
    
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
    
    return matchesSearch && matchesStatus && matchesSchool && matchesTeacher && matchesClass && matchesDate
  })

  const handleCreate = () => {
    setDialogType('create')
    setSelectedClass(null)
    setSessionType('subject_specific')
    setDialogOpen(true)
  }

  const handleEdit = (liveClass) => {
    setDialogType('update')
    setSelectedClass(liveClass)
    setSessionType(liveClass.session_type)
    setDialogOpen(true)
  }

  return (
    <div className='container mx-auto p-6'>
      <Card>
        <CardHeader>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div>
              <CardTitle className='text-2xl font-bold'>{isReadOnly ? 'Live Classes' : 'Manage Live Classes'}</CardTitle>
              <CardDescription>
                {isReadOnly 
                  ? 'View scheduled YouTube Live lecture sessions and their status'
                  : 'Efficiently manage YouTube Live lecture sessions with automatic status updates'}
              </CardDescription>
            </div>
            {!isReadOnly && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreate}>
                  <Plus className='mr-2 h-4 w-4' />
                  Create Live Class
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>
                    {dialogType === 'create' ? 'Create New Live Class' : 'Edit Live Class'}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogType === 'create' 
                      ? 'Create a new live class session. Start Time and End Time are mandatory.' 
                      : 'Update the live class information. Start Time and End Time are mandatory.'}
                  </DialogDescription>
                </DialogHeader>
                <Form method='post'>
                  <input type='hidden' name='intent' value={dialogType === 'create' ? 'create' : 'update'} />
                  {dialogType === 'update' && (
                    <input type='hidden' name='id' value={selectedClass?.id} />
                  )}
                  <div className='grid gap-4 py-4'>
                    <div className='grid gap-2'>
                      <Label htmlFor='title'>Lecture Title *</Label>
                      <Input
                        id='title'
                        name='title'
                        placeholder='e.g., Mathematics Live Lecture'
                        required
                        defaultValue={selectedClass?.title || ''}
                      />
                    </div>
                    
                    <div className='grid gap-2'>
                      <Label htmlFor='youtube_live_link'>YouTube Live Link *</Label>
                      <Input
                        id='youtube_live_link'
                        name='youtube_live_link'
                        type='url'
                        placeholder='https://www.youtube.com/watch?v=...'
                        required
                        defaultValue={selectedClass?.youtube_live_link || ''}
                      />
                    </div>

                    <div className='grid gap-2'>
                      <Label htmlFor='zoom_link'>Zoom Live Link (Optional)</Label>
                      <Input
                        id='zoom_link'
                        name='zoom_link'
                        type='url'
                        placeholder='https://zoom.us/j/...'
                        value={zoomLink}
                        onChange={(e) => setZoomLink(e.target.value)}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Enter the link to the Zoom meeting for this class session.
                      </p>
                    </div>

                    <div className='grid gap-2'>
                      <Label htmlFor='session_type'>Session Type *</Label>
                      <Select name='session_type' value={sessionType} onValueChange={setSessionType} required>
                        <SelectTrigger>
                          <SelectValue placeholder='Select session type' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='subject_specific'>Subject-Specific Session</SelectItem>
                          <SelectItem value='other_topic'>Other Topic Session</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='grid gap-2'>
                      <Label htmlFor='topic_name'>Topic Name *</Label>
                      <Input
                        id='topic_name'
                        name='topic_name'
                        placeholder='e.g., Algebra Basics, Career Guidance'
                        required
                        defaultValue={selectedClass?.topic_name || ''}
                      />
                    </div>

                    {sessionType === 'subject_specific' && (
                      <div className='grid gap-2'>
                        <Label htmlFor='subject_id'>Subject</Label>
                        <Select name='subject_id' defaultValue={selectedClass?.subject_id?.toString()}>
                          <SelectTrigger>
                            <SelectValue placeholder='Select subject' />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id.toString()}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className='grid gap-2'>
                      <Label htmlFor='class_id'>Class *</Label>
                      <Select 
                        name='class_id' 
                        required 
                        defaultValue={selectedClass?.class_id?.toString()}
                        onValueChange={handleClassChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select class' />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id.toString()}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {user.role_name !== 'teacher' && (
                      <div className='grid gap-2'>
                        <Label htmlFor='teacher_id'>Teacher *</Label>
                        <Select name='teacher_id' required defaultValue={selectedClass?.teacher_id?.toString()}>
                          <SelectTrigger>
                            <SelectValue placeholder='Select teacher' />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map((t) => (
                              <SelectItem key={t.id} value={t.id.toString()}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(user.role_name === 'super_admin' || user.role_name === 'school_admin') && (
                      <div className='grid gap-2'>
                        <Label htmlFor='school_id'>School *</Label>
                        <Select name='school_id' required>
                          <SelectTrigger>
                            <SelectValue placeholder='Select school' />
                          </SelectTrigger>
                          <SelectContent>
                            {user.role_name === 'super_admin' && (
                              <SelectItem value='all'>All Schools</SelectItem>
                            )}
                            {schools.map((school) => (
                              <SelectItem key={school.id} value={school.id.toString()}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className='grid grid-cols-2 gap-4'>
                      <div className='grid gap-2'>
                        <Label htmlFor='start_time'>Start Time *</Label>
                        <Input
                          id='start_time'
                          name='start_time'
                          type='datetime-local'
                          required
                          defaultValue={selectedClass?.start_time ? new Date(selectedClass.start_time).toISOString().slice(0, 16) : ''}
                        />
                      </div>
                      <div className='grid gap-2'>
                        <Label htmlFor='end_time'>End Time *</Label>
                        <Input
                          id='end_time'
                          name='end_time'
                          type='datetime-local'
                          required
                          defaultValue={selectedClass?.end_time ? new Date(selectedClass.end_time).toISOString().slice(0, 16) : ''}
                        />
                      </div>
                    </div>
                  </div>
                  <div className='flex justify-end space-x-2'>
                    <Button type='button' variant='outline' onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type='submit' disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : dialogType === 'create' ? 'Create Class' : 'Update Class'}
                    </Button>
                  </div>
                </Form>
              </DialogContent>
            </Dialog>
            )}
          </div>

          {/* Filters */}
          <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4'>
            <div className='relative'>
              <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search classes...'
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className='pl-8'
              />
            </div>
            
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='upcoming'>Upcoming</SelectItem>
                <SelectItem value='live'>Live</SelectItem>
                <SelectItem value='completed'>Completed</SelectItem>
              </SelectContent>
            </Select>

            {user.role_name === 'super_admin' && (
              <Select value={filters.school} onValueChange={(value) => setFilters(prev => ({ ...prev, school: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder='School' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id.toString()}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filters.teacher} onValueChange={(value) => setFilters(prev => ({ ...prev, teacher: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='Teacher' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Teachers</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id.toString()}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.class} onValueChange={(value) => setFilters(prev => ({ ...prev, class: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='Class' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id.toString()}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.date} onValueChange={(value) => setFilters(prev => ({ ...prev, date: value }))}>
              <SelectTrigger>
                <SelectValue placeholder='Date' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Dates</SelectItem>
                <SelectItem value='today'>Today</SelectItem>
                <SelectItem value='tomorrow'>Tomorrow</SelectItem>
                <SelectItem value='this_week'>This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-center'>Title</TableHead>
                  <TableHead className='text-center'>Topic</TableHead>
                  <TableHead className='text-center'>Class</TableHead>
                  <TableHead className='text-center'>Teacher</TableHead>
                  {user.role_name === 'super_admin' && <TableHead className='text-center'>Schools</TableHead>}
                  <TableHead className='text-center'>Start Time</TableHead>
                  <TableHead className='text-center'>End Time</TableHead>
                  <TableHead className='text-center'>Status</TableHead>
                  {!isReadOnly && <TableHead className='text-center'>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLiveClasses?.length ? (
                  filteredLiveClasses.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className='text-center font-medium'>{lc.title}</TableCell>
                      <TableCell className='text-center'>{lc.topic_name}</TableCell>
                      <TableCell className='text-center'>{lc.class_name}</TableCell>
                      <TableCell className='text-center'>{lc.teacher_name}</TableCell>
                      {user.role_name === 'super_admin' && (
                        <TableCell className='text-center'>
                          {lc.school_count > 1 ? `All Schools (${lc.school_count})` : lc.school_names}
                        </TableCell>
                      )}
                      <TableCell className='text-center'>
                        {lc.start_time ? new Date(lc.start_time).toLocaleString() : 'Not set'}
                      </TableCell>
                      <TableCell className='text-center'>
                        {lc.end_time ? new Date(lc.end_time).toLocaleString() : 'Not set'}
                      </TableCell>
                      <TableCell className='text-center'>
                        {getStatusBadge(lc.status)}
                      </TableCell>
                      <TableCell className='text-center'>
                        <div className='flex justify-center space-x-2'>
                          {!isReadOnly && (
                            <Button variant='outline' size='sm' onClick={() => handleEdit(lc)}>
                              <Edit className='h-4 w-4' />
                            </Button>
                          )}
                          {!isReadOnly && (
                            <Form method='post' style={{display: 'inline'}}>
                              <input type='hidden' name='intent' value='delete' />
                              <input type='hidden' name='id' value={lc.id} />
                              <Button 
                                type='submit' 
                                variant='outline' 
                                size='sm' 
                                onClick={(e) => {
                                  const message = lc.is_all_schools 
                                    ? `Are you sure you want to delete "${lc.title}" from all schools? This action cannot be undone.`
                                    : `Are you sure you want to delete "${lc.title}"? This action cannot be undone.`
                                  if (!confirm(message)) {
                                    e.preventDefault()
                                  }
                                }}
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </Form>
                          )}
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => window.open(lc.youtube_live_link, '_blank')}
                            title='Open YouTube Live'
                          >
                            <ExternalLink className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={user.role_name === 'super_admin' ? 9 : (isReadOnly ? 7 : 8)} className='h-24 text-center'>
                      No live classes found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
