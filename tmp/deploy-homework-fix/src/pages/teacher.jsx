import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import {
  useLoaderData,
  useSubmit,
  useNavigate,
  useActionData,
} from '@remix-run/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PencilIcon, TrashIcon, PlusIcon } from 'lucide-react'

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export async function loader() {
  const teachers = await query(
    `SELECT id, name, email, created_at FROM users WHERE role_id = ?`,
    [4]
  )

  // Fetch all classes
  const classes = await query(
    `SELECT id, name 
     FROM classes 
     ORDER BY name`
  )

  // Fetch all subjects with their class information
  const subjects = await query(
    `SELECT s.id, s.name, sc.class_id, c.name AS class_name
     FROM subjects s
     JOIN subject_classes sc ON s.id = sc.subject_id
     JOIN classes c ON sc.class_id = c.id
     ORDER BY c.name, s.name`
  )

  const assignments = await query(
    `SELECT ta.id, ta.teacher_id, ta.subject_id, ta.class_id, 
            s.name as subject_name, 
            c.name as class_name
     FROM teacher_assignments ta
     JOIN subjects s ON ta.subject_id = s.id
     JOIN classes c ON ta.class_id = c.id
     ORDER BY ta.teacher_id, c.name, s.name`
  )

  // group assignments by teacher_id
  const teacherAssignments = {}
  assignments.forEach((a) => {
    if (!teacherAssignments[a.teacher_id]) {
      teacherAssignments[a.teacher_id] = []
    }
    teacherAssignments[a.teacher_id].push({
      id: a.id,
      subject_id: a.subject_id,
      subject_name: a.subject_name,
      class_id: a.class_id,
      class_name: a.class_name,
    })
  })

  return { teachers, classes, subjects, teacherAssignments }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create') {
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')

      const existing = await query(`SELECT id FROM users WHERE email = ?`, [
        email,
      ])
      if (existing.length > 0) {
        return {
          success: false,
          message:
            'A user with this email already exists. Please use a different email.',
        }
      }
      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(password, salt)
      await query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 4)`,
        [name, email, passwordHash]
      )
      return { success: true, message: 'Teacher created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')

      const existing = await query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, id]
      )
      if (existing.length > 0) {
        return {
          success: false,
          message:
            'A user with this email already exists. Please use a different email.',
        }
      }

      if (password) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(password, salt)
        await query(
          `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
          [name, email, passwordHash, id]
        )
      } else {
        await query(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [
          name,
          email,
          id,
        ])
      }
      return { success: true, message: 'Teacher updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query(`DELETE FROM teacher_assignments WHERE teacher_id = ?`, [id])
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return { success: true, message: 'Teacher deleted successfully' }
    }

    if (action === 'assign_subject') {
      const teacher_id = formData.get('teacher_id')
      const subject_id = formData.get('subject_id')
      const class_id = formData.get('class_id')

      if (!teacher_id || !subject_id || !class_id) {
        return {
          success: false,
          message: 'Teacher, subject, and class are all required.',
        }
      }

      const existing = await query(
        `SELECT id FROM teacher_assignments WHERE teacher_id = ? AND subject_id = ? AND class_id = ?`,
        [teacher_id, subject_id, class_id]
      )
      if (existing.length > 0) {
        return {
          success: false,
          message:
            'This subject is already assigned to this teacher for this class.',
        }
      }
      await query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id) VALUES (?, ?, ?)`,
        [teacher_id, subject_id, class_id]
      )
      return { success: true, message: 'Subject assigned successfully' }
    }

    if (action === 'remove_assignment') {
      const assignment_id = formData.get('assignment_id')
      await query(`DELETE FROM teacher_assignments WHERE id = ?`, [
        assignment_id,
      ])
      return {
        success: true,
        message: 'Subject assignment removed successfully',
      }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'An error occurred',
    }
  }
}

export default function Teacher() {
  const { teachers, classes, subjects, teacherAssignments } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState(null)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [currentTeacherId, setCurrentTeacherId] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [filteredSubjects, setFilteredSubjects] = useState([])

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success(actionData.message)
        setOpenDialog(false)
        setAssignDialogOpen(false)
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  // Filter subjects based on selected class
  useEffect(() => {
    if (selectedClassId) {
      const filtered = subjects.filter(
        (subject) =>
          subject.class_id && subject.class_id.toString() === selectedClassId
      )
      setFilteredSubjects(filtered)
    } else {
      setFilteredSubjects([])
    }
  }, [selectedClassId, subjects])

  const handleClassChange = (value) => {
    setSelectedClassId(value)
    // Clear subject selection when class changes
    const form = document.getElementById('assignSubjectForm')
    if (form) {
      const subjectSelect = form.elements['subject_id']
      if (subjectSelect) {
        subjectSelect.value = ''
      }
    }
  }

  const handleCreateTeacher = () => {
    setDialogType('create')
    setSelectedTeacher(null)
    setOpenDialog(true)
  }

  const handleEditTeacher = (teacher) => {
    setDialogType('update')
    setSelectedTeacher(teacher)
    setOpenDialog(true)
  }

  const openDeleteDialog = (teacher) => {
    setTeacherToDelete(teacher)
    setDeleteDialogOpen(true)
  }

  const handleDeleteTeacher = () => {
    const formData = new FormData()
    formData.append('_action', 'delete')
    formData.append('id', teacherToDelete.id)
    submit(formData, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleAssignSubject = (teacherId) => {
    setCurrentTeacherId(teacherId)
    setSelectedClassId('') // Reset selected class
    setAssignDialogOpen(true)
  }

  const handleRemoveAssignment = (assignmentId) => {
    const formData = new FormData()
    formData.append('_action', 'remove_assignment')
    formData.append('assignment_id', assignmentId)
    submit(formData, { method: 'post' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('_action', dialogType)
    if (dialogType === 'update' && selectedTeacher) {
      formData.append('id', selectedTeacher.id)
    }
    submit(formData, { method: 'post' })
  }

  const submitAssign = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('_action', 'assign_subject')
    formData.append('teacher_id', currentTeacherId)
    formData.append('class_id', selectedClassId) // Include the selected class ID
    submit(formData, { method: 'post' })
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
      id: 'subjects',
      header: 'Assigned Subjects',
      cell: ({ row }) => {
        const id = row.original.id
        const assigned = teacherAssignments[id] || []
        return (
          <div className='flex flex-col gap-1 items-center max-w-xs'>
            {assigned.length > 0 ? (
              <div className='flex flex-wrap gap-1 justify-center'>
                {assigned.map((a) => (
                  <Badge
                    key={a.id}
                    variant='secondary'
                    className='flex items-center gap-1 text-xs'
                  >
                    <span className='hidden sm:inline'>{a.subject_name} (Class {a.class_name})</span>
                    <span className='sm:hidden'>{a.subject_name} ({a.class_name})</span>
                    <button
                      className='ml-1 text-xs hover:text-destructive'
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className='text-muted-foreground text-xs sm:text-sm'>
                No subjects assigned
              </span>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleAssignSubject(id)}
              className='mt-1 h-6 text-xs'
            >
              <PlusIcon className='h-3 w-3' />
              <span className='hidden sm:inline ml-1'>Assign</span>
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) => (
        <div className='text-center'>
          {new Date(row.original.created_at).toLocaleDateString()}
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
            onClick={() => handleEditTeacher(row.original)}
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
    data: teachers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Teacher' : 'Edit Teacher'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Manage Teachers</h1>
        <Button onClick={handleCreateTeacher} className='w-full sm:w-auto'>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Teacher</span>
        </Button>
      </div>

      <div className='rounded-md border overflow-x-auto'>
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
                  No teachers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between py-4'>
        <div className='text-sm text-muted-foreground'>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className='flex space-x-2'>
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
      </div>

      {/* Create/Edit Teacher Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new teacher account.'
                : 'Update the teacher information.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='name'>Full Name</label>
                <Input
                  id='name'
                  name='name'
                  placeholder='Enter full name'
                  defaultValue={selectedTeacher?.name || ''}
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
                  defaultValue={selectedTeacher?.email || ''}
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label htmlFor='password'>
                  {dialogType === 'create'
                    ? 'Password'
                    : 'New Password (leave blank to keep current)'}
                </label>
                <Input
                  id='password'
                  name='password'
                  type='password'
                  placeholder={
                    dialogType === 'create'
                      ? 'Enter password'
                      : 'Enter new password or leave blank'
                  }
                  required={dialogType === 'create'}
                />
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
                {dialogType === 'create' ? 'Create Teacher' : 'Update Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Teacher Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete teacher "{teacherToDelete?.name}"?
              This will also remove all subject assignments for this teacher.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeacher}
              className='bg-destructive hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Subject Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Subject</DialogTitle>
            <DialogDescription>
              Select a subject to assign to this teacher.
            </DialogDescription>
          </DialogHeader>
          <form id='assignSubjectForm' onSubmit={submitAssign}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='class_id'>Class</label>
                <Select
                  value={selectedClassId}
                  onValueChange={handleClassChange}
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

              <div className='grid gap-2'>
                <label htmlFor='subject_id'>Subject</label>
                <Select name='subject_id' disabled={!selectedClassId} required>
                  <SelectTrigger className='w-full'>
                    <SelectValue
                      placeholder={
                        selectedClassId
                          ? 'Select a subject'
                          : 'Select a class first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map((subj) => (
                      <SelectItem key={subj.id} value={subj.id.toString()}>
                        {subj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setAssignDialogOpen(false)}
                type='button'
              >
                Cancel
              </Button>
              <Button type='submit' disabled={!selectedClassId}>
                Assign Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
