import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  useLoaderData,
  useSubmit,
  useNavigate,
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
  UserIcon,
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

export async function loader({ request }) {
  const user = await getUser(request)

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
  if (user.school_id) {
    whereConditions.push('sp.schools_id = ?')
    queryParams.push(user.school_id)
  }

  // Add WHERE conditions to the query if needed
  if (whereConditions.length > 0) {
    studentsQuery += ` AND ${whereConditions.join(' AND ')}`
  }

  const students = await query(studentsQuery, queryParams)

  // Get all classes or filter by user's class_ids if they exist
  let classesQuery = `SELECT id, name FROM classes`
  const classQueryParams = []

  if (user.class_ids && user.class_ids.length > 0) {
    classesQuery += ` WHERE id IN (${user.class_ids.map(() => '?').join(',')})`
    classQueryParams.push(...user.class_ids)
  }

  const classes = await query(classesQuery, classQueryParams)

  // Get all schools or filter by user's school_id if they have one
  let schoolsQuery = `SELECT id, name FROM schools`
  const schoolQueryParams = []

  if (user.school_id) {
    schoolsQuery += ` WHERE id = ?`
    schoolQueryParams.push(user.school_id)
  }

  const schools = await query(schoolsQuery, schoolQueryParams)

  return { user, students, classes, schools }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')
  const user = await getUser(request)

  try {
    if (action === 'create') {
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const enrollment_no = formData.get('enrollment_no')
      const date_of_birth = formData.get('date_of_birth')
      const class_id = formData.get('class_id')
      // Always use the user's school_id
      const schools_id = user.school_id

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

      const salt = await bcrypt.genSalt(10)
      const password_hash = await bcrypt.hash(password, salt)

      // Use query function instead of getConnection
      // Insert the user
      const userRes = await query(
        `INSERT INTO users
         (name, email, password_hash, role_id)
         VALUES (?, ?, ?, 5)`,
        [name, email, password_hash]
      )

      // Get the new user ID
      const userId = userRes.insertId

      // Insert the student profile
      await query(
        `INSERT INTO student_profiles
         (user_id, class_id, schools_id, enrollment_no, date_of_birth)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, class_id, schools_id, enrollment_no, date_of_birth]
      )

      return { success: true, message: 'Student created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const profile_id = formData.get('profile_id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const enrollment_no = formData.get('enrollment_no')
      const date_of_birth = formData.get('date_of_birth')
      const class_id = formData.get('class_id')
      // Always use the user's school_id
      const schools_id = user.school_id

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

      try {
        // Use query function instead of getConnection for updating
        if (password) {
          const password_hash = Buffer.from(password).toString('base64')
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

        return { success: true, message: 'Student updated successfully' }
      } catch (err) {
        throw err
      }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return { success: true, message: 'Student deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Student() {
  const { students, classes, schools, user } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

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
  }, [selectedStudent])

  const handleCreateStudent = () => {
    setDialogType('create')
    setSelectedStudent(null)
    setSelectedDate(null)
    setOpenDialog(true)
  }

  const handleEditStudent = (student) => {
    setDialogType('update')
    setSelectedStudent(student)
    setOpenDialog(true)
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

  const handleSubmit = (e) => {
    e.preventDefault()
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
        <div className='flex justify-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleEditStudent(row.original)}
          >
            <PencilIcon className='size-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => openDeleteDialog(row.original)}
          >
            <TrashIcon className='size-4' />
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
          <form onSubmit={handleSubmit}>
            <div className='grid gap-6 pb-4'>
              {/* Account Information */}
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
                      name='class_id'
                      defaultValue={selectedStudent?.class_id?.toString() || ''}
                      required
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
            </div>

            <DialogFooter>
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
              This will also remove their profile. This action cannot be undone.
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
