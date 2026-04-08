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

export async function loader() {
  const classes = await query(`SELECT * FROM classes`)
  return { classes }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create') {
      const name = formData.get('name')
      if (!/^\d+$/.test(name)) {
        return {
          success: false,
          message: 'Class name must contain only numbers (e.g., 1, 2, 3).',
        }
      }
      const existing = await query(`SELECT id FROM classes WHERE name = ?`, [
        name,
      ])
      if (existing.length > 0) {
        return {
          success: false,
          message:
            'A class with this name already exists. Please use a different name.',
        }
      }
      await query(`INSERT INTO classes (name) VALUES (?)`, [name])
      return { success: true, message: 'Class created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      if (!/^\d+$/.test(name)) {
        return {
          success: false,
          message: 'Class name must contain only numbers (e.g., 1, 2, 3).',
        }
      }
      const existing = await query(
        `SELECT id FROM classes WHERE name = ? AND id != ?`,
        [name, id]
      )
      if (existing.length > 0) {
        return {
          success: false,
          message:
            'A class with this name already exists. Please use a different name.',
        }
      }
      await query(`UPDATE classes SET name = ? WHERE id = ?`, [name, id])
      return { success: true, message: 'Class updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query(`DELETE FROM classes WHERE id = ?`, [id])
      return { success: true, message: 'Class deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function ClassManagement() {
  const { classes } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedClass, setSelectedClass] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)

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

  const handleCreateClass = () => {
    setDialogType('create')
    setSelectedClass(null)
    setOpenDialog(true)
  }

  const handleEditClass = (cls) => {
    setDialogType('update')
    setSelectedClass(cls)
    setOpenDialog(true)
  }

  const openDeleteDialog = (cls) => {
    setClassToDelete(cls)
    setDeleteDialogOpen(true)
  }

  const handleDeleteClass = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', classToDelete.id)
    submit(fd, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selectedClass) {
      fd.append('id', selectedClass.id)
    }
    submit(fd, { method: 'post' })
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'Class',
      cell: ({ row }) => (
        <div className='text-center flex items-center justify-center gap-2'>
          {row.original.name}
        </div>
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
            onClick={() => handleEditClass(row.original)}
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
    data: classes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Class' : 'Edit Class'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Manage Classes</h1>
        <Button onClick={handleCreateClass} className='w-full sm:w-auto'>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Class</span>
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
                  No classes found.
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

      {/* Create / Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new class.'
                : 'Update the class information.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='name'>Class Number</label>
                <Input
                  id='name'
                  name='name'
                  type='number'
                  placeholder='Enter class number (e.g., 1, 2, 3)'
                  defaultValue={selectedClass?.name || ''}
                  pattern='[0-9]*'
                  inputMode='numeric'
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
                {dialogType === 'create' ? 'Create Class' : 'Update Class'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete class "{classToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClass}
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
