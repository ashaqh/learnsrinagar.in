import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getClassesForSchool } from '@/services/classQuery.server'
import {
  useLoaderData,
  useSubmit,
  useActionData,
} from '@remix-run/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from 'lucide-react'

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

async function resolveEffectiveSchoolId(user) {
  if (user?.role_name !== 'school_admin') {
    return user?.school_id || null
  }

  if (user.school_id) {
    return user.school_id
  }

  const schools = await query(
    'SELECT id FROM schools WHERE users_id = ? LIMIT 1',
    [user.id]
  )

  return schools[0]?.id || null
}

export async function loader({ request }) {
  const user = await getUser(request)
  const schoolId = await resolveEffectiveSchoolId(user)

  // Build the students query with potential filters based on user permissions
  let studentsQuery = `
    SELECT u.id, u.name, u.email, u.created_at,
           sp.id AS profile_id,
           sp.enrollment_no, sp.date_of_birth,
           sp.class_id, sp.schools_id,
           c.name AS class_name,
           s.name AS school_name
    FROM users u
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    LEFT JOIN classes c          ON sp.class_id   = c.id
    LEFT JOIN schools s          ON sp.schools_id = s.id
    WHERE u.role_id = 5
  `

  const queryParams = []
  const whereConditions = []

  // Filter by class_ids if user has them
  if (user.class_ids && user.class_ids.length > 0) {
    whereConditions.push(
      `sp.class_id IN (${user.class_ids.map(() => '?').join(',')})`
    )
    queryParams.push(...user.class_ids)
  }

  // Filter by school_id if user has it
  if (schoolId) {
    whereConditions.push('sp.schools_id = ?')
    queryParams.push(schoolId)
  }

  // Add WHERE conditions to the query if needed
  if (whereConditions.length > 0) {
    studentsQuery += ` AND ${whereConditions.join(' AND ')}`
  }

  const students = await query(studentsQuery, queryParams)

  // Get all classes or filter by user's class_ids if they exist
  let classes = await getClassesForSchool(
    user.class_ids && user.class_ids.length > 0 ? null : schoolId
  )

  if (user.class_ids && user.class_ids.length > 0) {
    const allowedClassIds = new Set(user.class_ids.map(String))
    classes = classes.filter((cls) => allowedClassIds.has(String(cls.id)))
  }

  // Get all schools or filter by user's school_id if they have one
  let schoolsQuery = `SELECT id, name FROM schools`
  const schoolQueryParams = []

  if (schoolId) {
    schoolsQuery += ` WHERE id = ?`
    schoolQueryParams.push(schoolId)
  }

  const schools = await query(schoolsQuery, schoolQueryParams)

  // Get all parents
  const parents = await query(
    `SELECT id, name, email FROM users WHERE role_id = ?`,
    [6]
  )

  // Get parent-student links
  const links = await query(
    `SELECT psl.id, psl.parent_id, psl.student_id, p.name AS parent_name, p.email AS parent_email
     FROM parent_student_links psl
     JOIN users p ON psl.parent_id = p.id`
  )

  const studentParentLinks = {}
  links.forEach((ln) => {
    if (!studentParentLinks[ln.student_id])
      studentParentLinks[ln.student_id] = []
    studentParentLinks[ln.student_id].push({
      id: ln.id,
      parent_id: ln.parent_id,
      parent_name: ln.parent_name,
      parent_email: ln.parent_email,
    })
  })

  return { user, students, classes, schools, parents, studentParentLinks }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')
  const user = await getUser(request)
  const schoolId = await resolveEffectiveSchoolId(user)

  try {
    if (action === 'create') {
      // Student details
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const enrollment_no = formData.get('enrollment_no')
      const date_of_birth = formData.get('date_of_birth')
      const class_id = formData.get('class_id')
      const schools_id = schoolId

      // Parent details
      const addParent = formData.get('add_parent') === 'on'
      const parentName = formData.get('parent_name')
      const parentEmail = formData.get('parent_email')
      const parentPassword = formData.get('parent_password')
      const existingParentId = formData.get('existing_parent_id')

      if (!schools_id) {
        return {
          success: false,
          message: 'Your account is not linked to a school yet.',
        }
      }

      // Check for duplicate student email
      const dupEmail = await query('SELECT id FROM users WHERE email = ?', [
        email,
      ])
      if (dupEmail.length > 0) {
        return {
          success: false,
          message:
            'A user with this email already exists. Please use a different email.',
        }
      }

      // Check for duplicate enrollment number
      const dupEnroll = await query(
        'SELECT id FROM student_profiles WHERE enrollment_no = ?',
        [enrollment_no]
      )
      if (dupEnroll.length > 0) {
        return {
          success: false,
          message:
            'A student with this enrollment number already exists. Please use a different number.',
        }
      }

      // Check for duplicate parent email if adding a new parent
      if (addParent && !existingParentId && parentEmail) {
        const dupParentEmail = await query(
          'SELECT id FROM users WHERE email = ?',
          [parentEmail]
        )
        if (dupParentEmail.length > 0) {
          return {
            success: false,
            message:
              'A user with this parent email already exists. Please use a different email.',
          }
        }
      }

      const salt = await bcrypt.genSalt(10)
      const password_hash = await bcrypt.hash(password, salt)

      // Insert the student user
      const userRes = await query(
        `INSERT INTO users
         (name, email, password_hash, role_id)
         VALUES (?, ?, ?, 5)`,
        [name, email, password_hash]
      )

      // Get the new student user ID
      const studentId = userRes.insertId

      // Insert the student profile
      await query(
        `INSERT INTO student_profiles
         (user_id, class_id, schools_id, enrollment_no, date_of_birth)
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, class_id, schools_id, enrollment_no, date_of_birth]
      )

      // Handle parent creation/linking
      let parentId = null

      if (addParent) {
        // Use existing parent if selected
        if (existingParentId) {
          parentId = existingParentId
        }
        // Create new parent if provided with details
        else if (parentName && parentEmail && parentPassword) {
          const salt = await bcrypt.genSalt(10)
          const parentPasswordHash = await bcrypt.hash(parentPassword, salt)

          const parentRes = await query(
            `INSERT INTO users
             (name, email, password_hash, role_id)
             VALUES (?, ?, ?, 6)`,
            [parentName, parentEmail, parentPasswordHash]
          )

          parentId = parentRes.insertId
        }

        // Link parent to student if we have a valid parent ID
        if (parentId) {
          await query(
            `INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)`,
            [parentId, studentId]
          )
        }
      }

      return { success: true, message: 'Student created successfully' }
    }

    if (action === 'update') {
      // Student details
      const id = formData.get('id')
      const profile_id = formData.get('profile_id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const enrollment_no = formData.get('enrollment_no')
      const date_of_birth = formData.get('date_of_birth')
      const class_id = formData.get('class_id')
      const schools_id = schoolId

      // Parent details
      const addParent = formData.get('add_parent') === 'on'
      const parentName = formData.get('parent_name')
      const parentEmail = formData.get('parent_email')
      const parentPassword = formData.get('parent_password')
      const existingParentId = formData.get('existing_parent_id')

      if (!schools_id) {
        return {
          success: false,
          message: 'Your account is not linked to a school yet.',
        }
      }

      // Check for duplicate student email
      const dupEmail = await query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      )
      if (dupEmail.length > 0) {
        return {
          success: false,
          message:
            'A user with this email already exists. Please use a different email.',
        }
      }

      // Check for duplicate enrollment number
      const dupEnroll = await query(
        'SELECT id FROM student_profiles WHERE enrollment_no = ? AND id != ?',
        [enrollment_no, profile_id]
      )
      if (dupEnroll.length > 0) {
        return {
          success: false,
          message:
            'A student with this enrollment number already exists. Please use a different number.',
        }
      }

      // Check for duplicate parent email if adding a new parent
      if (addParent && !existingParentId && parentEmail) {
        const dupParentEmail = await query(
          'SELECT id FROM users WHERE email = ?',
          [parentEmail]
        )
        if (dupParentEmail.length > 0) {
          return {
            success: false,
            message:
              'A user with this parent email already exists. Please use a different email.',
          }
        }
      }

      try {
        // Update student user
        if (password) {
          const salt = await bcrypt.genSalt(10)
          const password_hash = await bcrypt.hash(password, salt)
          await query(
            `UPDATE users
             SET name = ?, email = ?, password_hash = ?
             WHERE id = ?`,
            [name, email, password_hash, id]
          )
        } else {
          await query(
            `UPDATE users
             SET name = ?, email = ?
             WHERE id = ?`,
            [name, email, id]
          )
        }

        // Update or create student profile
        if (profile_id) {
          await query(
            `UPDATE student_profiles
             SET class_id = ?, schools_id = ?, enrollment_no = ?, date_of_birth = ?
             WHERE id = ?`,
            [class_id, schools_id, enrollment_no, date_of_birth, profile_id]
          )
        } else {
          await query(
            `INSERT INTO student_profiles
             (user_id, class_id, schools_id, enrollment_no, date_of_birth)
             VALUES (?, ?, ?, ?, ?)`,
            [id, class_id, schools_id, enrollment_no, date_of_birth]
          )
        }

        // Handle parent creation/linking
        let parentId = null

        if (addParent) {
          // Use existing parent if selected
          if (existingParentId) {
            parentId = existingParentId
          }
          // Create new parent if provided with details
          else if (parentName && parentEmail) {
            // Check if this parent already exists
            const existingParent = await query(
              'SELECT id FROM users WHERE email = ? AND role_id = 6',
              [parentEmail]
            )

            if (existingParent.length > 0) {
              parentId = existingParent[0].id
            } else {
              // Create new parent with proper password hashing
              const salt = await bcrypt.genSalt(10)
              const parentPasswordHash = parentPassword
                ? await bcrypt.hash(parentPassword, salt)
                : await bcrypt.hash('default123', salt)

              const parentRes = await query(
                `INSERT INTO users
                 (name, email, password_hash, role_id)
                 VALUES (?, ?, ?, 6)`,
                [parentName, parentEmail, parentPasswordHash]
              )

              parentId = parentRes.insertId
            }
          }

          // Link parent to student if we have a valid parent ID and it's not already linked
          if (parentId) {
            const existingLink = await query(
              `SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?`,
              [parentId, id]
            )

            if (existingLink.length === 0) {
              await query(
                `INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)`,
                [parentId, id]
              )
            }
          }
        }

        return { success: true, message: 'Student updated successfully' }
      } catch (err) {
        throw err
      }
    }

    if (action === 'delete') {
      const id = formData.get('id')

      // First delete parent-student links
      await query(`DELETE FROM parent_student_links WHERE student_id = ?`, [id])

      // Then delete student profile and user
      await query(`DELETE FROM student_profiles WHERE user_id = ?`, [id])
      await query(`DELETE FROM users WHERE id = ?`, [id])

      return { success: true, message: 'Student deleted successfully' }
    }

    if (action === 'remove_parent_link') {
      const linkId = formData.get('link_id')
      await query(`DELETE FROM parent_student_links WHERE id = ?`, [linkId])
      return { success: true, message: 'Parent link removed successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Student() {
  const { students, classes, schools, user, parents, studentParentLinks } =
    useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [addParent, setAddParent] = useState(false)
  const [useExistingParent, setUseExistingParent] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedExistingParentId, setSelectedExistingParentId] = useState('')

  useEffect(() => {
    if (actionData) {
      actionData.success
        ? toast.success(actionData.message)
        : toast.error(actionData.message)
      if (actionData.success) setOpenDialog(false)
    }
  }, [actionData])

  useEffect(() => {
    if (selectedStudent?.date_of_birth) {
      setSelectedDate(new Date(selectedStudent.date_of_birth))
    } else {
      setSelectedDate(null)
    }

    // Reset parent-related state when student selection changes
    setAddParent(false)
    setUseExistingParent(false)
    setSelectedClassId(selectedStudent?.class_id?.toString() || '')
    setSelectedExistingParentId('')
  }, [selectedStudent])

  const handleCreateStudent = () => {
    setDialogType('create')
    setSelectedStudent(null)
    setSelectedDate(null)
    setOpenDialog(true)
    setAddParent(false)
    setUseExistingParent(false)
    setSelectedClassId('')
    setSelectedExistingParentId('')
  }

  const handleEditStudent = (student) => {
    setDialogType('update')
    setSelectedStudent(student)
    setOpenDialog(true)
    setSelectedClassId(student?.class_id?.toString() || '')
    setSelectedExistingParentId('')
  }

  const openDeleteDialog = (student) => {
    setStudentToDelete(student)
    setDeleteDialogOpen(true)
  }

  const handleDeleteStudent = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', studentToDelete.id)
    submit(fd, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleRemoveParentLink = (linkId) => {
    const fd = new FormData()
    fd.append('_action', 'remove_parent_link')
    fd.append('link_id', linkId)
    submit(fd, { method: 'post' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (classes.length > 0 && !selectedClassId) {
      toast.error('Please select a class.')
      return
    }

    if (addParent && useExistingParent && !selectedExistingParentId) {
      toast.error('Please select an existing parent.')
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selectedStudent) {
      fd.append('id', selectedStudent.id)
      if (selectedStudent.profile_id) {
        fd.append('profile_id', selectedStudent.profile_id)
      }
    }
    if (selectedDate) {
      fd.set('date_of_birth', format(selectedDate, 'yyyy-MM-dd'))
    }
    fd.set('class_id', selectedClassId)
    fd.set('add_parent', addParent ? 'on' : '')
    fd.set(
      'existing_parent_id',
      useExistingParent ? selectedExistingParentId : ''
    )
    submit(fd, { method: 'post' })
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <div className='text-center'>{row.original.name}</div>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.email}</div>
      ),
    },
    {
      accessorKey: 'enrollment_no',
      header: 'Enrollment No',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.enrollment_no || '-'}</div>
      ),
    },
    {
      accessorKey: 'class_name',
      header: 'Class',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.class_name || '-'}</div>
      ),
    },
    {
      id: 'parents',
      header: 'Linked Parents',
      cell: ({ row }) => {
        const sid = row.original.id
        const linked = studentParentLinks[sid] || []
        return (
          <div className='flex flex-wrap gap-1 justify-center'>
            {linked.length > 0 ? (
              linked.map((ln) => (
                <Badge
                  key={ln.id}
                  variant='secondary'
                  className='flex items-center gap-1'
                >
                  {ln.parent_name}
                  <button
                    className='ml-1 text-xs hover:text-destructive'
                    onClick={() => handleRemoveParentLink(ln.id)}
                  >
                    ×
                  </button>
                </Badge>
              ))
            ) : (
              <span className='text-muted-foreground text-sm'>
                No parents linked
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'date_of_birth',
      header: 'Date of Birth',
      cell: ({ row }) => (
        <div className='text-center'>
          {row.original.date_of_birth
            ? new Date(row.original.date_of_birth).toLocaleDateString()
            : '-'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex justify-center gap-1 sm:gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleEditStudent(row.original)}
            className='p-2'
          >
            <PencilIcon className='size-3 sm:size-4' />
            <span className='sr-only'>Edit</span>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => openDeleteDialog(row.original)}
            className='p-2'
          >
            <TrashIcon className='size-3 sm:size-4' />
            <span className='sr-only'>Delete</span>
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Student' : 'Edit Student'

  return (
    <div className='container mx-auto pb-10'>
      <div className='flex justify-between items-center mb-6'>
        <span className='ml-2 pt-2 text-xl font-semibold'>Manage Students</span>
        <Button onClick={handleCreateStudent}>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Student</span>
        </Button>
      </div>

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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  No students found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-end space-x-2 py-4'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      {/* Create/Edit Student Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new student account.'
                : 'Update the student information.'}
            </DialogDescription>
          </DialogHeader>
          <form
            key={`${dialogType}-${selectedStudent?.id ?? 'new'}`}
            onSubmit={handleSubmit}
          >
            <input type='hidden' name='class_id' value={selectedClassId} />
            <input
              type='hidden'
              name='add_parent'
              value={addParent ? 'on' : ''}
            />
            <input
              type='hidden'
              name='existing_parent_id'
              value={useExistingParent ? selectedExistingParentId : ''}
            />
            <div className='grid gap-6 pb-4'>
              {/* Student Information */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid gap-2'>
                  <label htmlFor='name'>Name</label>
                  <Input
                    id='name'
                    name='name'
                    placeholder='Enter full name'
                    defaultValue={selectedStudent?.name || ''}
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label htmlFor='email'>Email</label>
                  <Input
                    id='email'
                    name='email'
                    type='email'
                    placeholder='Enter email address'
                    defaultValue={selectedStudent?.email || ''}
                    required
                  />
                </div>
                <div className='grid gap-2 col-span-2'>
                  <label htmlFor='password'>Password</label>
                  <Input
                    id='password'
                    name='password'
                    type='password'
                    placeholder={
                      dialogType === 'create'
                        ? 'Enter password'
                        : 'leave blank to keep current'
                    }
                    required={dialogType === 'create'}
                  />
                </div>
              </div>

              {/* Profile Information */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid gap-2'>
                  <label htmlFor='enrollment_no'>Enrollment Number</label>
                  <Input
                    id='enrollment_no'
                    name='enrollment_no'
                    type='number'
                    placeholder='Enter enrollment number'
                    defaultValue={selectedStudent?.enrollment_no || ''}
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label htmlFor='date_of_birth'>Date of Birth</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant='outline'
                        className={`w-full justify-start text-left font-normal ${
                          !selectedDate && 'text-muted-foreground'
                        }`}
                      >
                        <CalendarIcon className='mr-2 h-4 w-4' />
                        {selectedDate
                          ? format(selectedDate, 'PPP')
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0'>
                      <Calendar
                        mode='single'
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Only show class selection if there are classes available for this user */}
                {classes.length > 0 ? (
                  <div className='grid gap-2 col-span-2'>
                    <label htmlFor='class_id'>Class</label>
                    <Select
                      value={selectedClassId}
                      onValueChange={setSelectedClassId}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select a class' />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            Class {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className='grid gap-2 col-span-2'>
                    <label htmlFor='class_id'>Class</label>
                    <p className='text-sm text-muted-foreground'>
                      No classes available for your account.
                    </p>
                    <input
                      type='hidden'
                      name='class_id'
                      value={selectedStudent?.class_id || ''}
                    />
                  </div>
                )}
              </div>

              {/* Parent Information */}
              <div className='border-t pt-4 mt-2'>
                <div className='flex items-center space-x-2 mb-4'>
                  <Checkbox
                    id='add_parent'
                    checked={addParent}
                    onCheckedChange={(checked) => {
                      const shouldAddParent = checked === true
                      setAddParent(shouldAddParent)
                      if (!shouldAddParent) {
                        setUseExistingParent(false)
                        setSelectedExistingParentId('')
                      }
                    }}
                  />
                  <label htmlFor='add_parent' className='text-base font-medium'>
                    {dialogType === 'create'
                      ? 'Add parent information'
                      : 'Link or add a new parent'}
                  </label>
                </div>

                {addParent && (
                  <>
                    {/* Display current linked parents in edit mode */}
                    {dialogType === 'update' && selectedStudent && (
                      <>
                        <div className='mb-4'>
                          <h4 className='font-medium mb-2'>
                            Current linked parents:
                          </h4>
                          <div className='flex flex-wrap gap-2'>
                            {studentParentLinks[selectedStudent.id]?.map(
                              (parent) => (
                                <Badge
                                  key={parent.id}
                                  variant='secondary'
                                  className='flex items-center gap-1'
                                >
                                  {parent.parent_name} ({parent.parent_email})
                                  <button
                                    className='ml-1 text-xs hover:text-destructive'
                                    type='button'
                                    onClick={() =>
                                      handleRemoveParentLink(parent.id)
                                    }
                                  >
                                    ×
                                  </button>
                                </Badge>
                              )
                            ) || (
                              <span className='text-muted-foreground'>
                                No parents linked
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div className='flex items-center space-x-2 mb-4'>
                      <Checkbox
                        id='use_existing_parent'
                        checked={useExistingParent}
                        onCheckedChange={(checked) => {
                          const shouldUseExistingParent = checked === true
                          setUseExistingParent(shouldUseExistingParent)
                          if (!shouldUseExistingParent) {
                            setSelectedExistingParentId('')
                          }
                        }}
                      />
                      <label
                        htmlFor='use_existing_parent'
                        className='text-sm font-medium'
                      >
                        Use existing parent
                      </label>
                    </div>

                    {useExistingParent ? (
                      <div className='grid gap-2 mb-4'>
                        <label htmlFor='existing_parent_id'>
                          Select Parent
                        </label>
                        <Select
                          value={selectedExistingParentId}
                          onValueChange={setSelectedExistingParentId}
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Select a parent' />
                          </SelectTrigger>
                          <SelectContent>
                            {parents.map((parent) => (
                              <SelectItem
                                key={parent.id}
                                value={parent.id.toString()}
                              >
                                {parent.name} ({parent.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='grid gap-2'>
                          <label htmlFor='parent_name'>Parent Name</label>
                          <Input
                            id='parent_name'
                            name='parent_name'
                            placeholder='Enter parent full name'
                            required={addParent && !useExistingParent}
                          />
                        </div>
                        <div className='grid gap-2'>
                          <label htmlFor='parent_email'>Parent Email</label>
                          <Input
                            id='parent_email'
                            name='parent_email'
                            type='email'
                            placeholder='Enter parent email address'
                            required={addParent && !useExistingParent}
                          />
                        </div>
                        <div className='grid gap-2 col-span-2'>
                          <label htmlFor='parent_password'>
                            Parent Password
                          </label>
                          <Input
                            id='parent_password'
                            name='parent_password'
                            type='password'
                            placeholder={
                              dialogType === 'create'
                                ? 'Enter parent password'
                                : 'Leave blank to set default password'
                            }
                            required={
                              dialogType === 'create' &&
                              addParent &&
                              !useExistingParent
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <DialogFooter className='mt-4'>
              <Button
                variant='outline'
                onClick={() => setOpenDialog(false)}
                type='button'
              >
                Cancel
              </Button>
              <Button type='submit'>
                {dialogType === 'create' ? 'Create Student' : 'Update Student'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete student "{studentToDelete?.name}"?
              This will also remove all parent links for this student. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              className='bg-destructive hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
