import { useState, useEffect } from 'react'
import { query } from '@/lib/db'
import { useLoaderData, useSubmit, useActionData } from '@remix-run/react'
import { toast } from 'sonner'
import bcrypt from 'bcryptjs'
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
  const roles = await query(`SELECT * FROM roles`)
  const admins = await query(
    `
    SELECT u.*, r.name AS role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.role_id = ?
  `,
    [2]
  )
  return { roles, admins }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')

  try {
    if (action === 'create') {
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const role_id = 2

      const salt = bcrypt.genSaltSync(10)
      const password_hash = bcrypt.hashSync(password, salt)

      await query(
        `INSERT INTO users (name, email, password_hash, role_id)
         VALUES (?, ?, ?, ?)`,
        [name, email, password_hash, role_id]
      )
      return { success: true, message: 'Admin created successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')

      if (password && password.trim() !== '') {
        // Hash and update password if provided
        const salt = bcrypt.genSaltSync(10)
        const password_hash = bcrypt.hashSync(password, salt)

        await query(
          `UPDATE users
           SET name = ?, email = ?, password_hash = ?
           WHERE id = ?`,
          [name, email, password_hash, id]
        )
      } else {
        // Skip password update if not provided
        await query(
          `UPDATE users
           SET name = ?, email = ?
           WHERE id = ?`,
          [name, email, id]
        )
      }
      return { success: true, message: 'Admin updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return { success: true, message: 'Admin deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('email')) {
      return {
        success: false,
        message:
          'This email address is already in use. Please use a different email.',
      }
    }
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Admins() {
  const { admins } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState(null)

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

  const handleCreateAdmin = () => {
    setDialogType('create')
    setSelectedAdmin(null)
    setOpenDialog(true)
  }

  const handleEditAdmin = (admin) => {
    setDialogType('update')
    setSelectedAdmin(admin)
    setOpenDialog(true)
  }

  const openDeleteDialog = (admin) => {
    setAdminToDelete(admin)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAdmin = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', adminToDelete.id)
    submit(fd, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selectedAdmin) {
      fd.append('id', selectedAdmin.id)
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
            onClick={() => handleEditAdmin(row.original)}
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
    data: admins,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Admin' : 'Edit Admin'

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Manage Admins</h1>
        <Button onClick={handleCreateAdmin} className='w-full sm:w-auto'>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Admin</span>
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
                  No admins found.
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

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new admin.'
                : 'Update the admin information.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='name'>Name</label>
                <Input
                  id='name'
                  name='name'
                  placeholder='Enter admin name'
                  defaultValue={selectedAdmin?.name || ''}
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label htmlFor='email'>Email</label>
                <Input
                  id='email'
                  name='email'
                  type='email'
                  placeholder='Enter admin email'
                  defaultValue={selectedAdmin?.email || ''}
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label htmlFor='password'>Password</label>
                <Input
                  id='password'
                  name='password'
                  type='password'
                  placeholder={
                    dialogType === 'create'
                      ? 'Enter password'
                      : 'Leave blank to keep current password'
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
                {dialogType === 'create' ? 'Create Admin' : 'Update Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete admin "{adminToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
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
