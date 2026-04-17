import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

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

export async function loader() {
  const subjects = await query(`SELECT * FROM subjects`)
  const classes = await query(`SELECT * FROM classes`)
  const subjectClasses = await query(`
    SELECT sc.subject_id, sc.class_id, c.name as class_name
    FROM subject_classes sc
    JOIN classes c ON sc.class_id = c.id
  `)

  const subjectClassMap = {}
  for (const sc of subjectClasses) {
    if (!subjectClassMap[sc.subject_id]) {
      subjectClassMap[sc.subject_id] = []
    }
    subjectClassMap[sc.subject_id].push({
      id: sc.class_id,
      name: sc.class_name,
    })
  }

  const subjectsWithClasses = subjects.map((subject) => ({
    ...subject,
    classes: subjectClassMap[subject.id] || [],
    class_names: (subjectClassMap[subject.id] || [])
      .map((c) => c.name)
      .join(', '),
  }))

  return { subjects: subjectsWithClasses, classes }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create') {
      const name = formData.get('name')
      const classIds = formData.getAll('class_ids')

      if (!name || !classIds.length) {
        return {
          success: false,
          message: 'Subject name and at least one class are required.',
        }
      }

      // Ensure we have at least one class id for the database constraint
      if (classIds.length === 0) {
        return {
          success: false,
          message: 'Please select at least one class.',
        }
      }

      const existingSubjects = await query(
        `SELECT id FROM subjects WHERE name = ?`,
        [name]
      )

      if (existingSubjects.length > 0) {
        return {
          success: false,
          message:
            'A subject with this name already exists. Please use a different name.',
        }
      }

      // Use the first selected class as the default class_id
      const defaultClassId = classIds[0]
      const result = await query(
        `INSERT INTO subjects (name, class_id) VALUES (?, ?)`,
        [name, defaultClassId]
      )

      const subjectId = result.insertId

      if (subjectId) {
        const values = classIds
          .map((classId) => [subjectId, classId])
          .join('), (')
        await query(
          `INSERT INTO subject_classes (subject_id, class_id) VALUES (${values})`
        )
      }

      return { success: true, message: 'Subject created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const classIds = formData.getAll('class_ids')

      if (!name || !classIds.length) {
        return {
          success: false,
          message: 'Subject name and at least one class are required.',
        }
      }

      const existingSubjects = await query(
        `SELECT id FROM subjects WHERE name = ? AND id != ?`,
        [name, id]
      )

      if (existingSubjects.length > 0) {
        return {
          success: false,
          message:
            'Another subject with this name already exists. Please use a different name.',
        }
      }

      // Update the subject name and set default class_id for backward compatibility
      const defaultClassId = classIds[0]
      await query(`UPDATE subjects SET name = ?, class_id = ? WHERE id = ?`, [
        name,
        defaultClassId,
        id,
      ])

      await query(`DELETE FROM subject_classes WHERE subject_id = ?`, [id])

      if (classIds.length > 0) {
        const values = classIds.map((classId) => [id, classId]).join('), (')
        await query(
          `INSERT INTO subject_classes (subject_id, class_id) VALUES (${values})`
        )
      }

      return { success: true, message: 'Subject updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')

      await query(`DELETE FROM subjects WHERE id = ?`, [id])

      return { success: true, message: 'Subject deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Subject() {
  const { subjects, classes } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [subjectToDelete, setSubjectToDelete] = useState(null)
  const [selectedClasses, setSelectedClasses] = useState([])

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success(actionData.message)
        setOpenDialog(false)
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  useEffect(() => {
    if (selectedSubject && selectedSubject.classes) {
      setSelectedClasses(selectedSubject.classes.map((c) => c.id.toString()))
    } else {
      setSelectedClasses([])
    }
  }, [selectedSubject])

  const handleCreateSubject = () => {
    setDialogType('create')
    setSelectedSubject(null)
    setSelectedClasses([])
    setOpenDialog(true)
  }

  const handleEditSubject = (subject) => {
    setDialogType('update')
    setSelectedSubject(subject)
    setOpenDialog(true)
  }

  const openDeleteDialog = (subject) => {
    setSubjectToDelete(subject)
    setDeleteDialogOpen(true)
  }

  const handleDeleteSubject = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', subjectToDelete.id)
    submit(fd, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const toggleClassSelection = (classId) => {
    setSelectedClasses((prev) => {
      const strClassId = classId.toString()
      if (prev.includes(strClassId)) {
        return prev.filter((id) => id !== strClassId)
      } else {
        return [...prev, strClassId]
      }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)

    selectedClasses.forEach((classId) => {
      fd.append('class_ids', classId)
    })

    if (dialogType === 'update' && selectedSubject) {
      fd.append('id', selectedSubject.id)
    }
    submit(fd, { method: 'post' })
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'Subject',
      cell: ({ row }) => <div className='text-center'>{row.original.name}</div>,
    },
    {
      accessorKey: 'class_names',
      header: 'Classes',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.class_names}</div>
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
            onClick={() => handleEditSubject(row.original)}
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
    data: subjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Subject' : 'Edit Subject'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Manage Subjects</h1>
        <Button onClick={handleCreateSubject} className='w-full sm:w-auto'>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Subject</span>
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
            {table.getRowModel().rows.length ? (
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
                  No subjects found.
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

      {/* Create / Edit Subject Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new subject.'
                : 'Update the subject information.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='name'>Subject Name</label>
                <Input
                  id='name'
                  name='name'
                  placeholder='Enter subject name'
                  defaultValue={selectedSubject?.name || ''}
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label>Classes</label>
                <div className='border rounded-md p-4 max-h-60 overflow-y-auto'>
                  <div className='space-y-2'>
                    {classes.map((cls) => (
                      <div key={cls.id} className='flex items-center space-x-2'>
                        <Checkbox
                          id={`class-${cls.id}`}
                          checked={selectedClasses.includes(cls.id.toString())}
                          onCheckedChange={() => toggleClassSelection(cls.id)}
                        />
                        <label
                          htmlFor={`class-${cls.id}`}
                          className='text-sm cursor-pointer'
                        >
                          Class {cls.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedClasses.length === 0 && (
                  <p className='text-sm text-red-500 mt-1'>
                    Please select at least one class.
                  </p>
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
              <Button type='submit' disabled={selectedClasses.length === 0}>
                {dialogType === 'create' ? 'Create Subject' : 'Update Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete subject "{subjectToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubject}
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
