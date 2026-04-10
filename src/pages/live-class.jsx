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
import { Plus, Edit, Trash2, ExternalLink, Play, Clock, CheckCircle, Search } from 'lucide-react'

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  formatLiveClassDateTimeForDb,
  formatLiveClassDateTimeForDisplay,
  formatLiveClassDateTimeForInput,
  normalizeLiveClassRecords,
} from '@/lib/liveClassDateTime'

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

export async function loader({ request }) {
  try {
    const user = await getUser(request)
    if (!user) return redirect('/login')

    // Check permissions - only authorized roles can access
    const authorizedRoles = ['super_admin', 'school_admin', 'teacher']
    if (!authorizedRoles.includes(user.role_name)) {
      throw new Response('Access denied', { status: 403 })
    }

    let classes = []
    let subjects = []
    let teachers = []
    let liveClasses = []
    let schools = []

  if (user.role_name === 'super_admin') {
    // Super admin can see all
    const schoolsResult = await query('SELECT * FROM schools ORDER BY name')
    const classesResult = await query('SELECT * FROM classes ORDER BY name')
    const subjectsResult = await query('SELECT * FROM subjects ORDER BY name')
    const teachersResult = await query(
      'SELECT id, name FROM users WHERE role_id = 4 ORDER BY name'
    )
    const liveClassesResult = await query(`
      SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
      FROM live_classes lc
      LEFT JOIN subjects s ON lc.subject_id = s.id
      LEFT JOIN classes c ON lc.class_id = c.id
      LEFT JOIN users u ON lc.teacher_id = u.id
      LEFT JOIN schools sch ON lc.school_id = sch.id
      ORDER BY lc.created_at DESC
    `)

    schools = schoolsResult
    classes = classesResult
    subjects = subjectsResult
    teachers = teachersResult
    liveClasses = normalizeLiveClassRecords(liveClassesResult)
  } else if (user.role_name === 'school_admin') {
    // School admin can see their school's data
    const schoolsResult = await query('SELECT * FROM schools WHERE users_id = ?', [user.id])
    const schoolId = schoolsResult[0]?.id
    
    if (schoolId) {
      const classesResult = await query('SELECT * FROM classes ORDER BY name')
      const subjectsResult = await query('SELECT * FROM subjects ORDER BY name')
      const teachersResult = await query(
        'SELECT id, name FROM users WHERE role_id = 4 ORDER BY name'
      )
      const liveClassesResult = await query(`
        SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
        FROM live_classes lc
        LEFT JOIN subjects s ON lc.subject_id = s.id
        LEFT JOIN classes c ON lc.class_id = c.id
        LEFT JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN schools sch ON lc.school_id = sch.id
        WHERE lc.school_id = ?
        ORDER BY lc.created_at DESC
      `, [schoolId])

      schools = schoolsResult
      classes = classesResult
      subjects = subjectsResult
      teachers = teachersResult
      liveClasses = normalizeLiveClassRecords(liveClassesResult)
    }
  } else if (user.role_name === 'teacher') {
    // Teachers can only see their assigned classes and subjects
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
      SELECT lc.*, s.name as subject_name, c.name as class_name, u.name as teacher_name, sch.name as school_name
      FROM live_classes lc
      LEFT JOIN subjects s ON lc.subject_id = s.id
      JOIN classes c ON lc.class_id = c.id
      JOIN users u ON lc.teacher_id = u.id
      LEFT JOIN schools sch ON lc.school_id = sch.id
      WHERE lc.teacher_id = ?
      ORDER BY lc.created_at DESC
    `, [user.id])

    classes = classesResult
    subjects = subjectsResult
    teachers = [{ id: user.id, name: user.name }]
    liveClasses = normalizeLiveClassRecords(liveClassesResult)
  }

    return { classes, subjects, teachers, liveClasses, schools, user }
  } catch (error) {
    console.error('Live class loader error:', error)
    throw new Response('Database error: ' + error.message, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await getUser(request)
  if (!user) return redirect('/login')

  if (user.role_name === 'teacher') {
    return {
      success: false,
      message: 'You have view-only access to live classes',
    }
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
      const start_time = formatLiveClassDateTimeForDb(formData.get('start_time'))
      const end_time = formatLiveClassDateTimeForDb(formData.get('end_time'))
      
      const zoom_link = formData.get('zoom_link')
      
      if (
        (user.role_name === 'super_admin' || user.role_name === 'school_admin') &&
        !school_id
      ) {
        return {
          success: false,
          message: 'Please select a school or choose All Schools',
        }
      }

      if (!start_time || !end_time) {
        return {
          success: false,
          message: 'Start Time and End Time are mandatory fields',
        }
      }
      
      const status = formData.get('status') || 'scheduled'
      
      let created_by_role = 'teacher'
      if (user.role_name === 'super_admin') created_by_role = 'super_admin'
      else if (user.role_name === 'school_admin') created_by_role = 'school_admin'

      const isAllSchools = school_id === 'all' && user.role_name === 'super_admin'
      const notificationTargetSchoolId = isAllSchools ? null : school_id

      // If "all" schools selected, create session for each school
      if (isAllSchools) {
        const allSchools = await query('SELECT id FROM schools')
        
        for (const school of allSchools) {
          await query(
            `INSERT INTO live_classes (title, youtube_live_link, zoom_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, start_time, end_time, status, created_by_role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              title,
              youtube_live_link,
              zoom_link,
              session_type,
              topic_name,
              subject_id,
              class_id,
              teacher_id,
              school.id,
              start_time,
              end_time,
              status,
              created_by_role
            ]
          )
        }
      } else {
        await query(
          `INSERT INTO live_classes (title, youtube_live_link, zoom_link, session_type, topic_name, subject_id, class_id, teacher_id, school_id, start_time, end_time, status, created_by_role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            youtube_live_link,
            zoom_link,
            session_type,
            topic_name,
            subject_id,
            class_id,
            teacher_id,
            school_id,
            start_time,
            end_time,
            status,
            created_by_role
          ]
        )
      }

      try {
        const { notificationService } = await import('@/services/notificationService.server')
        const { getLiveClassNotification } = await import(
          '@/services/notificationHelper.server'
        )

        const notificationMessage = await getLiveClassNotification({
          topic_name,
          class_id,
          teacher_id: teacher_id || user.id,
          start_time,
        })

        await notificationService.sendNotification({
          title: 'New Live Class Scheduled',
          message: notificationMessage,
          eventType: 'CLASS_SCHEDULED',
          targetType: isAllSchools ? 'all' : 'group',
          targetId: isAllSchools ? null : class_id,
          audienceContext: isAllSchools ? null : { schoolId: notificationTargetSchoolId },
          metadata: {
            topic: topic_name,
            startTime: start_time,
            title,
            zoomLink: zoom_link,
          },
          senderId: user.id,
        })
      } catch (notifyError) {
        console.error('Failed to send live class notification from dashboard:', notifyError)
      }

      return {
        success: true,
        message: isAllSchools
          ? 'Live class created for all schools successfully'
          : 'Live class created successfully',
      }
    } else if (intent === 'update') {
      const id = formData.get('id')
      const title = formData.get('title')
      const youtube_live_link = formData.get('youtube_live_link')
      const session_type = formData.get('session_type')
      const topic_name = formData.get('topic_name')
      const subject_id = formData.get('subject_id') || null
      const class_id = formData.get('class_id')
      const start_time = formatLiveClassDateTimeForDb(formData.get('start_time'))
      const end_time = formatLiveClassDateTimeForDb(formData.get('end_time'))
      
      const zoom_link = formData.get('zoom_link')
      
      if (!start_time || !end_time) {
        return {
          success: false,
          message: 'Start Time and End Time are mandatory fields',
        }
      }
      
      const status = formData.get('status')

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

export default function LiveClass() {
  const { classes, subjects, teachers, liveClasses, schools, user } = useLoaderData()
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const isReadOnly = user?.role_name === 'teacher'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedClass, setSelectedClass] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [sessionType, setSessionType] = useState('subject_specific')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedFormClassId, setSelectedFormClassId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('scheduled')
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    teacher: 'all',
    class: 'all'
  })

  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.message)
      setDialogOpen(false)
      setSelectedClass(null)
    } else if (actionData?.success === false) {
      toast.error(actionData.message)
    }
  }, [actionData])

  const handleCreate = () => {
    setDialogType('create')
    setSelectedClass(null)
    setSessionType('subject_specific')
    setSelectedSubjectId('')
    setSelectedTeacherId(teachers[0]?.id?.toString() || '')
    setSelectedSchoolId(
      user.role_name === 'school_admin'
        ? schools[0]?.id?.toString() || user.school_id?.toString() || ''
        : ''
    )
    setSelectedFormClassId(classes[0]?.id?.toString() || '')
    setSelectedStatus('scheduled')
    setDialogOpen(true)
  }

  const handleEdit = (liveClass) => {
    setDialogType('update')
    setSelectedClass(liveClass)
    setSessionType(liveClass.session_type)
    setSelectedSubjectId(liveClass.subject_id?.toString() || '')
    setSelectedTeacherId(
      liveClass.teacher_id?.toString() || teachers[0]?.id?.toString() || ''
    )
    setSelectedSchoolId(
      liveClass.school_id?.toString() ||
        (user.role_name === 'school_admin'
          ? schools[0]?.id?.toString() || user.school_id?.toString() || ''
          : '')
    )
    setSelectedFormClassId(liveClass.class_id?.toString() || '')
    setSelectedStatus(liveClass.status || 'scheduled')
    setDialogOpen(true)
  }

  const columns = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className='text-center font-medium'>{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'session_type',
      header: 'Type',
      cell: ({ row }) => (
        <div className='text-center'>
          <Badge variant={row.original.session_type === 'subject_specific' ? 'default' : 'secondary'}>
            {row.original.session_type === 'subject_specific' ? 'Subject' : 'Other Topic'}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'topic_name',
      header: 'Topic',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.topic_name}</div>
      ),
    },
    {
      accessorKey: 'subject_name',
      header: 'Subject',
      cell: ({ row }) => (
        <div className='text-center'>
          {row.original.subject_name || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'class_name',
      header: 'Class',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.class_name}</div>
      ),
    },
    {
      accessorKey: 'teacher_name',
      header: 'Teacher',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.teacher_name}</div>
      ),
    },
    {
      accessorKey: 'start_time',
      header: 'Start Time',
      cell: ({ row }) => (
        <div className='text-center'>
          {row.original.start_time
            ? formatLiveClassDateTimeForDisplay(row.original.start_time)
            : 'Not scheduled'}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className='text-center'>
          {getStatusBadge(row.original.status)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex justify-center space-x-2'>
          {!isReadOnly && (
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleEdit(row.original)}
              >
                <Edit className='h-4 w-4' />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setToDelete(row.original)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Live Class</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{toDelete?.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Form method='post'>
                      <input type='hidden' name='intent' value='delete' />
                      <input type='hidden' name='id' value={toDelete?.id} />
                      <AlertDialogAction type='submit'>Delete</AlertDialogAction>
                    </Form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => window.open(row.original.youtube_live_link, '_blank')}
            title='Open YouTube Live'
          >
            <ExternalLink className='h-4 w-4' />
          </Button>
        </div>
      ),
    },
  ]

  const filteredLiveClasses = liveClasses.filter(lc => {
    const matchesSearch = !filters.search || 
      lc.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      lc.topic_name?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesStatus = filters.status === 'all' || lc.status === filters.status
    const matchesTeacher = filters.teacher === 'all' || lc.teacher_id?.toString() === filters.teacher
    const matchesClass = filters.class === 'all' || lc.class_id?.toString() === filters.class
    
    return matchesSearch && matchesStatus && matchesTeacher && matchesClass
  })

  const table = useReactTable({
    data: filteredLiveClasses,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='container mx-auto p-6'>
      <Card>
        <CardHeader>
          <div className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle className='text-2xl font-bold'>Live Classes</CardTitle>
              <CardDescription>
                {isReadOnly
                  ? 'View live lecture sessions for students'
                  : 'Manage YouTube Live lecture sessions for students'}
              </CardDescription>
            </div>
            {!isReadOnly && (
              <Button onClick={handleCreate}>
                <Plus className='mr-2 h-4 w-4' />
                Add Live Session
              </Button>
            )}
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mt-4'>
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
                <SelectItem value='scheduled'>Scheduled</SelectItem>
                <SelectItem value='live'>Live</SelectItem>
                <SelectItem value='completed'>Completed</SelectItem>
              </SelectContent>
            </Select>

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
          </div>
        </CardHeader>
        
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <div style={{display: 'none'}} />
            </DialogTrigger>
              <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>
                    {dialogType === 'create'
                      ? 'Create New Live Session'
                      : 'Edit Live Session'}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogType === 'create'
                      ? 'Add a new YouTube Live lecture session for students.'
                      : 'Update the live session information.'}
                  </DialogDescription>
                </DialogHeader>
                <Form
                  key={`${dialogType}-${selectedClass?.id ?? 'new'}`}
                  method='post'
                >
                <input
                  type='hidden'
                  name='intent'
                  value={dialogType === 'create' ? 'create' : 'update'}
                />
                {dialogType === 'update' && (
                  <input type='hidden' name='id' value={selectedClass?.id} />
                )}
                <input type='hidden' name='session_type' value={sessionType} />
                <input type='hidden' name='subject_id' value={selectedSubjectId} />
                <input type='hidden' name='class_id' value={selectedFormClassId} />
                <input type='hidden' name='teacher_id' value={selectedTeacherId} />
                <input type='hidden' name='school_id' value={selectedSchoolId} />
                <input type='hidden' name='status' value={selectedStatus} />
                <div className='grid gap-4 py-4'>
                  <div className='grid gap-2'>
                    <Label htmlFor='title'>Session Title *</Label>
                    <Input
                      id='title'
                      name='title'
                      placeholder='e.g., Mathematics Live Session'
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
                    <Label htmlFor='session_type'>Session Type *</Label>
                    <Select 
                      value={sessionType} 
                      onValueChange={(value) => {
                        setSessionType(value)
                        if (value === 'other_topic') {
                          setSelectedSubjectId('')
                        }
                      }}
                    >
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
                      <Select
                        value={selectedSubjectId}
                        onValueChange={setSelectedSubjectId}
                      >
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
                      value={selectedFormClassId}
                      onValueChange={setSelectedFormClassId}
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
                      <Select
                        value={selectedTeacherId}
                        onValueChange={setSelectedTeacherId}
                      >
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
                      <Select
                        value={selectedSchoolId}
                        onValueChange={setSelectedSchoolId}
                      >
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
                        defaultValue={formatLiveClassDateTimeForInput(
                          selectedClass?.start_time
                        )}
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label htmlFor='end_time'>End Time *</Label>
                      <Input
                        id='end_time'
                        name='end_time'
                        type='datetime-local'
                        required
                        defaultValue={formatLiveClassDateTimeForInput(
                          selectedClass?.end_time
                        )}
                      />
                    </div>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='status'>Status *</Label>
                    <Select
                      value={selectedStatus}
                      onValueChange={setSelectedStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select status' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='scheduled'>Scheduled</SelectItem>
                        <SelectItem value='live'>Live Now</SelectItem>
                        <SelectItem value='completed'>Completed</SelectItem>
                        <SelectItem value='cancelled'>Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='flex justify-end space-x-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving...'
                      : dialogType === 'create'
                      ? 'Create Session'
                      : 'Update Session'}
                  </Button>
                </div>
                </Form>
              </DialogContent>
          </Dialog>
        )}
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} className='text-center'>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className='text-center'>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='h-24 text-center'
                    >
                      No live sessions found.
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
