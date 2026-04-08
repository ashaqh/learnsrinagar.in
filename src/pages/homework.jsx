import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
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
  PencilIcon,
  TrashIcon,
  PlusIcon,
  BookOpenIcon,
  EyeIcon,
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
import { Label } from '@/components/ui/label'

export async function loader({ request }) {
  const user = await getUser(request)

  let homeworkQuery = `
    SELECT h.id, h.title, h.description, h.created_at,
           h.subject_id, h.teacher_id, 
           s.name AS subject_name,
           c.name AS class_name,
           u.name AS teacher_name
    FROM homework h
    JOIN subjects s ON h.subject_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN users u ON h.teacher_id = u.id
  `

  const queryParams = []
  const whereConditions = []

  if (user.role_name === 'teacher') {
    whereConditions.push('h.teacher_id = ?')
    queryParams.push(user.id)
  } else if (user.role_name === 'school_admin' || user.role_name === 'super_admin') {
    // School admin and super admin see all homework — no filter needed
  } else if (user.class_ids && user.class_ids.length > 0) {
    whereConditions.push(
      `s.class_id IN (${user.class_ids.map(() => '?').join(',')})`
    )
    queryParams.push(...user.class_ids)
  }

  if (whereConditions.length > 0) {
    homeworkQuery += ` WHERE ${whereConditions.join(' AND ')}`
  }

  homeworkQuery += ` ORDER BY h.created_at DESC`

  const homework = await query(homeworkQuery, queryParams)

  let subjectsQuery = `
    SELECT s.id, s.name, c.name AS class_name 
    FROM subjects s
    JOIN classes c ON s.class_id = c.id
  `

  const subjectParams = []
  const subjectConditions = []

  if (user.role_name === 'teacher') {
    subjectConditions.push(`
      s.id IN (
        SELECT subject_id 
        FROM teacher_assignments 
        WHERE teacher_id = ?
      )
    `)
    subjectParams.push(user.id)
  } else if (user.role_name === 'school_admin' || user.role_name === 'super_admin') {
    // School admin and super admin see all subjects — no filter needed
  } else if (user.class_ids && user.class_ids.length > 0) {
    subjectConditions.push(
      `s.class_id IN (${user.class_ids.map(() => '?').join(',')})`
    )
    subjectParams.push(...user.class_ids)
  }

  if (subjectConditions.length > 0) {
    subjectsQuery += ` WHERE ${subjectConditions.join(' AND ')}`
  }

  subjectsQuery += ` ORDER BY c.name, s.name`

  const subjects = await query(subjectsQuery, subjectParams)

  return { user, homework, subjects }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')
  const user = await getUser(request)

  try {
    if (action === 'create') {
      // Only teachers can create homework
      if (user.role_name !== 'teacher') {
        return { success: false, message: 'Only teachers can create homework' }
      }

      const title = formData.get('title')
      const description = formData.get('description')
      const subject_id = formData.get('subject_id')

      const teacher_id = user.id

      await query(
        `INSERT INTO homework (title, description, subject_id, teacher_id)
         VALUES (?, ?, ?, ?)`,
        [title, description, subject_id, teacher_id]
      )

      return { success: true, message: 'Homework created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const title = formData.get('title')
      const description = formData.get('description')
      const subject_id = formData.get('subject_id')

      if (user.role_name !== 'teacher') {
        return { success: false, message: 'Only teachers can update homework' }
      } else {
        await query(
          `UPDATE homework
           SET title = ?, description = ?, subject_id = ?
           WHERE id = ? AND teacher_id = ?`,
          [title, description, subject_id, id, user.id]
        )
      }

      return { success: true, message: 'Homework updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')

      if (user.role_name !== 'teacher') {
        return { success: false, message: 'Only teachers can delete homework' }
      } else {
        await query(`DELETE FROM homework WHERE id = ? AND teacher_id = ?`, [
          id,
          user.id,
        ])
      }

      return { success: true, message: 'Homework deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Homework() {
  const { homework, subjects, user } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedHomework, setSelectedHomework] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [homeworkToDelete, setHomeworkToDelete] = useState(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [homeworkToView, setHomeworkToView] = useState(null)

  useEffect(() => {
    if (actionData) {
      actionData.success
        ? toast.success(actionData.message)
        : toast.error(actionData.message)
      if (actionData.success) {
        setOpenDialog(false)
        setDeleteDialogOpen(false)
      }
    }
  }, [actionData])

  const handleCreateHomework = () => {
    setDialogType('create')
    setSelectedHomework(null)
    setOpenDialog(true)
  }

  const handleEditHomework = (homework) => {
    setDialogType('update')
    setSelectedHomework(homework)
    setOpenDialog(true)
  }

  const handleViewHomework = (homework) => {
    setHomeworkToView(homework)
    setViewDialogOpen(true)
  }

  const openDeleteDialog = (homework) => {
    setHomeworkToDelete(homework)
    setDeleteDialogOpen(true)
  }

  const handleDeleteHomework = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', homeworkToDelete.id)
    submit(fd, { method: 'post' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selectedHomework) {
      fd.append('id', selectedHomework.id)
    }
    submit(fd, { method: 'post' })
  }

  const canModify = (homework) => {
    return user.role_name === 'teacher' && homework.teacher_id === user.id
  }

  const isTeacher = user.role_name === 'teacher'

  const columns = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'subject_name',
      header: 'Subject',
      cell: ({ row }) => (
        <div className='text-center'>
          {row.original.subject_name} ({row.original.class_name})
        </div>
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
            onClick={() => handleViewHomework(row.original)}
            className='p-2'
          >
            <EyeIcon className='size-3 sm:size-4' />
            <span className='sr-only'>View</span>
          </Button>
          {canModify(row.original) && (
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleEditHomework(row.original)}
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
            </>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: homework,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Homework' : 'Edit Homework'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>{isTeacher ? 'Manage Homework' : 'Homework'}</h1>
        {isTeacher && (
          <Button onClick={handleCreateHomework} className='w-full sm:w-auto'>
            <PlusIcon className='mr-2 h-4 w-4' />
            <span>Add Homework</span>
          </Button>
        )}
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, rowIndex) => {
                const isLatest = rowIndex === 0 && table.getState().pagination.pageIndex === 0;
                return (
                  <TableRow
                    key={row.id}
                    className={isLatest ? 'bg-purple-50 border-l-4 border-l-purple-500 font-medium' : ''}
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
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No homework assignments found.
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

      {isTeacher && (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className='max-w-2xl'>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                {dialogType === 'create'
                  ? 'Fill out the form below to create a new homework assignment.'
                  : 'Update the homework information.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className='grid gap-6 pb-4'>
                <div className='grid gap-2'>
                  <label htmlFor='title'>Title</label>
                  <Input
                    id='title'
                    name='title'
                    placeholder='Enter homework title'
                    defaultValue={selectedHomework?.title || ''}
                    required
                  />
                </div>

                <div className='grid gap-2'>
                  <label htmlFor='subject_id'>Subject</label>
                  <Select
                    name='subject_id'
                    defaultValue={
                      selectedHomework?.subject_id?.toString() || ''
                    }
                    required
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select a subject' />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem
                          key={subject.id}
                          value={subject.id.toString()}
                        >
                          {subject.name} (Class {subject.class_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid gap-2'>
                  <label htmlFor='description'>Description</label>
                  <Textarea
                    id='description'
                    name='description'
                    placeholder='Enter homework description'
                    rows={5}
                    defaultValue={selectedHomework?.description || ''}
                    required
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
                  {dialogType === 'create'
                    ? 'Create Homework'
                    : 'Update Homework'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isTeacher && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader className='text-center'>
              <AlertDialogTitle>Delete Homework</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the homework "
                {homeworkToDelete?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className='flex justify-end'>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteHomework}
                className='bg-destructive hover:bg-destructive/90'
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <BookOpenIcon className='h-5 w-5' />
              <span>Homework Details</span>
            </DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-2 gap-4 py-4'>
            <div>
              <Label htmlFor='title' className='text-sm font-medium'>
                Title
              </Label>
              <Input
                type='text'
                id='title'
                value={homeworkToView?.title}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor='subject' className='text-sm font-medium'>
                Subject
              </Label>
              <Input
                type='text'
                id='subject'
                value={`${homeworkToView?.subject_name} (${homeworkToView?.class_name})`}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor='teacher' className='text-sm font-medium'>
                Teacher
              </Label>
              <Input
                type='text'
                id='teacher'
                value={homeworkToView?.teacher_name}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor='created_at' className='text-sm font-medium'>
                Created At
              </Label>
              <Input
                type='text'
                id='created_at'
                value={new Date(homeworkToView?.created_at).toLocaleString()}
                readOnly
              />
            </div>
            <div className='col-span-2'>
              <Label htmlFor='description' className='text-sm font-medium'>
                Description
              </Label>
              <Textarea
                id='description'
                value={homeworkToView?.description}
                readOnly
                rows={5}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
