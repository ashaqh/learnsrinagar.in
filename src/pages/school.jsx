import { useState, useEffect } from 'react'
import { query } from '@/lib/db'
import {
  useLoaderData,
  useSubmit,
  useActionData,
} from '@remix-run/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

export async function loader() {
  const users = await query(`SELECT id, name FROM users WHERE role_id = ?`, [
    2,
  ])

  const schools = await query(
    `SELECT s.*, u.name as user_name FROM schools s JOIN users u ON s.users_id = u.id`
  )

  return {
    users,
    schools,
  }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create') {
      const name = formData.get('name')
      const address = formData.get('address')
      const users_id = formData.get('users_id')

      const existingSchool = await query(
        `SELECT id FROM schools WHERE users_id = ?`,
        [users_id]
      )

      if (existingSchool && existingSchool.length > 0) {
        return {
          success: false,
          message:
            'This user already has a school associated with them. One user can only have one school.',
        }
      }

      const result = await query(
        `INSERT INTO schools (name, address, users_id) VALUES (?, ?, ?)`,
        [name, address, users_id]
      )

      try {
        const { notificationService } = await import('@/services/notificationService.server')
        const { getSchoolLifecycleNotification } = await import(
          '@/services/notificationHelper.server'
        )
        const message = await getSchoolLifecycleNotification({
          action: 'created',
          schoolName: name,
          associatedUserId: users_id,
        })

        await notificationService.sendNotification({
          title: 'New School Added',
          message,
          eventType: 'SCHOOL_CREATED',
          targetType: 'all',
          metadata: {
            schoolId: String(result.insertId),
            schoolName: name,
          },
        })
      } catch (notifyError) {
        console.error('Failed to send school creation notification:', notifyError)
      }

      return { success: true, message: 'School created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const address = formData.get('address')
      const users_id = formData.get('users_id')

      const existingSchool = await query(
        `SELECT id FROM schools WHERE users_id = ? AND id != ?`,
        [users_id, id]
      )

      if (existingSchool && existingSchool.length > 0) {
        return {
          success: false,
          message:
            'This user already has another school associated with them. One user can only have one school.',
        }
      }

      await query(
        `UPDATE schools SET name = ?, address = ?, users_id = ? WHERE id = ?`,
        [name, address, users_id, id]
      )

      return { success: true, message: 'School updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      const existingSchool = await query(`SELECT name FROM schools WHERE id = ?`, [id])

      if (existingSchool.length === 0) {
        return { success: false, message: 'School not found' }
      }

      await query(`DELETE FROM schools WHERE id = ?`, [id])

      try {
        const { notificationService } = await import('@/services/notificationService.server')
        const { getSchoolLifecycleNotification } = await import(
          '@/services/notificationHelper.server'
        )
        const message = await getSchoolLifecycleNotification({
          action: 'deleted',
          schoolName: existingSchool[0].name,
        })

        await notificationService.sendNotification({
          title: 'School Removed',
          message,
          eventType: 'SCHOOL_REMOVED',
          targetType: 'all',
          metadata: {
            schoolId: String(id),
            schoolName: existingSchool[0].name,
          },
        })
      } catch (notifyError) {
        console.error('Failed to send school deletion notification:', notifyError)
      }

      return { success: true, message: 'School deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'An error occurred',
    }
  }
}

export default function School() {
  const { schools, users } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState('')

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

  const handleCreateSchool = () => {
    setDialogType('create')
    setSelectedSchool(null)
    setSelectedUserId(users[0]?.id?.toString() || '')
    setOpenDialog(true)
  }

  const handleEditSchool = (school) => {
    setDialogType('update')
    setSelectedSchool(school)
    setSelectedUserId(school?.users_id?.toString() || '')
    setOpenDialog(true)
  }

  const openDeleteDialog = (school) => {
    setSchoolToDelete(school)
    setDeleteDialogOpen(true)
  }

  const handleDeleteSchool = () => {
    const formData = new FormData()
    formData.append('_action', 'delete')
    formData.append('id', schoolToDelete.id)

    submit(formData, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    formData.append('_action', dialogType)

    if (dialogType === 'update' && selectedSchool) {
      formData.append('id', selectedSchool.id)
    }

    submit(formData, { method: 'post' })
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'School Name',
      cell: ({ row }) => row.getValue('name'),
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => row.getValue('address'),
    },
    {
      accessorKey: 'user_name',
      header: 'Associated User',
      cell: ({ row }) => row.getValue('user_name'),
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) =>
        new Date(row.getValue('created_at')).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex justify-center gap-1 sm:gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleEditSchool(row.original)}
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
    data: schools,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New School' : 'Edit School'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Manage Schools</h1>
        <Button onClick={handleCreateSchool} className='w-full sm:w-auto'>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add School</span>
        </Button>
      </div>

      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
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
                  No schools found.
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

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new school.'
                : 'Update the school information.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              <input type='hidden' name='users_id' value={selectedUserId} />
              <div className='grid gap-2'>
                <label htmlFor='name'>School Name</label>
                <Input
                  id='name'
                  name='name'
                  placeholder='Enter school name'
                  defaultValue={selectedSchool?.name || ''}
                  required
                />
              </div>

              <div className='grid gap-2'>
                <label htmlFor='address'>Address</label>
                <Textarea
                  id='address'
                  name='address'
                  placeholder='Enter school address'
                  defaultValue={selectedSchool?.address || ''}
                  rows={3}
                />
              </div>

              <div className='grid gap-2'>
                <label htmlFor='users_id'>Associated User</label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a user' />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {dialogType === 'create' ? 'Create School' : 'Update School'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete school "{schoolToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchool}
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
