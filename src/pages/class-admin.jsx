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
import { PencilIcon, TrashIcon, PlusIcon, UserIcon } from 'lucide-react'

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

  const users = await query('SELECT id, name FROM users WHERE role_id = ?', [
    3,
  ])
  // Schools are retrieved but only for displaying existing assignments
  const schools = await query('SELECT id, name FROM schools')
  const classes = await query('SELECT id, name FROM classes')
  const classAdmins = await query(`
    SELECT ca.id,
           ca.admin_id,
           ca.school_id,
           ca.class_id,
           ca.assigned_at,
           u.name       AS admin_name,
           u.email      AS admin_email,
           s.name       AS school_name,
           c.name       AS class_name
    FROM class_admins ca
    JOIN users u   ON ca.admin_id  = u.id
    JOIN schools s ON ca.school_id = s.id
    JOIN classes c ON ca.class_id  = c.id
  `)

  return { users, schools, classes, classAdmins, user }
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
      const school_id = user.school_id // Get school_id from logged-in user
      const class_id = formData.get('class_id')

      try {
        // Check if email exists
        const exists = await query('SELECT id FROM users WHERE email = ?', [
          email,
        ])
        if (exists.length > 0) {
          return {
            success: false,
            message: 'A user with this email already exists.',
          }
        }

        // Start transaction
        await query('START TRANSACTION')

        // Create user
        const salt = await bcrypt.genSalt(10)
        const password_hash = await bcrypt.hash(password, salt)
        const result = await query(
          'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 3)',
          [name, email, password_hash]
        )

        // Get the inserted ID
        const admin_id = result.insertId

        // Create class admin assignment
        await query(
          'INSERT INTO class_admins (admin_id, school_id, class_id) VALUES (?, ?, ?)',
          [admin_id, school_id, class_id]
        )

        // Commit the transaction
        await query('COMMIT')

        return {
          success: true,
          message: 'Class admin created and assigned successfully',
        }
      } catch (err) {
        // Rollback on error
        await query('ROLLBACK')
        throw err
      }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const school_id = user.school_id // Get school_id from logged-in user
      const class_id = formData.get('class_id')

      // Find the admin_id associated with this assignment
      const currentAssignment = await query(
        `SELECT admin_id FROM class_admins WHERE id = ?`,
        [id]
      )

      if (currentAssignment.length === 0) {
        return { success: false, message: 'Assignment not found' }
      }

      const admin_id = currentAssignment[0].admin_id

      // Check for email conflicts
      const emailExists = await query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, admin_id]
      )

      if (emailExists.length > 0) {
        return {
          success: false,
          message: 'A user with this email already exists.',
        }
      }

      try {
        // Start transaction
        await query('START TRANSACTION')

        // Update user details
        if (password && password.trim() !== '') {
          // Update with new password
          const salt = await bcrypt.genSalt(10)
          const password_hash = await bcrypt.hash(password, salt)
          await query(
            `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
            [name, email, password_hash, admin_id]
          )
        } else {
          // Update without changing password
          await query(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [
            name,
            email,
            admin_id,
          ])
        }

        // Update class assignment
        const exists = await query(
          `SELECT id
           FROM class_admins
           WHERE admin_id = ? AND school_id = ? AND class_id = ? AND id != ?`,
          [admin_id, school_id, class_id, id]
        )

        if (exists.length > 0) {
          await query('ROLLBACK')
          return { success: false, message: 'This assignment already exists.' }
        }

        await query(
          `UPDATE class_admins
           SET school_id = ?, class_id = ?
           WHERE id = ?`,
          [school_id, class_id, id]
        )

        await query('COMMIT')
        return {
          success: true,
          message: 'Class admin updated successfully',
        }
      } catch (err) {
        await query('ROLLBACK')
        throw err
      }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query('DELETE FROM class_admins WHERE id = ?', [id])
      return {
        success: true,
        message: 'Class admin assignment deleted successfully',
      }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function ClassAdmin() {
  const { users, schools, classes, classAdmins } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selected, setSelected] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)

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

  const handleCreate = () => {
    setDialogType('create')
    setSelected(null)
    setOpenDialog(true)
  }
  const handleEdit = (assignment) => {
    setDialogType('update')
    setSelected(assignment)
    setOpenDialog(true)
  }
  const openDelete = (assignment) => {
    setToDelete(assignment)
    setDeleteDialogOpen(true)
  }
  const handleDelete = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', toDelete.id)
    submit(fd, { method: 'post' })
    setDeleteDialogOpen(false)
  }
  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selected) {
      fd.append('id', selected.id)
    }
    submit(fd, { method: 'post' })
  }

  const columns = [
    {
      accessorKey: 'admin_name',
      header: 'Admin Name',
      cell: ({ row }) => (
        <div className='text-center flex items-center justify-center gap-2'>
          {row.original.admin_name}
        </div>
      ),
    },
    {
      accessorKey: 'admin_email',
      header: 'Email',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.admin_email}</div>
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
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex justify-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleEdit(row.original)}
          >
            <PencilIcon className='size-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => openDelete(row.original)}
          >
            <TrashIcon className='size-4' />
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: classAdmins,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Class Admin' : 'Edit Assignment'

  return (
    <div className='container mx-auto pb-10'>
      <div className='flex justify-between items-center mb-6'>
        <span className='ml-2 pt-2 text-xl font-semibold'>
          Manage Class Admins
        </span>
        <Button onClick={handleCreate}>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Class Admin</span>
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
                  No assignments found.
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

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Enter admin details and assign to school and class.'
                : 'Update the class admin assignment.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 pb-4'>
              {dialogType === 'create' && (
                <>
                  <div className='grid gap-2'>
                    <label htmlFor='name'>Admin Name</label>
                    <Input
                      id='name'
                      name='name'
                      placeholder='Enter name'
                      required
                    />
                  </div>
                  <div className='grid gap-2'>
                    <label htmlFor='email'>Email</label>
                    <Input
                      id='email'
                      name='email'
                      type='email'
                      placeholder='Enter email'
                      required
                    />
                  </div>
                  <div className='grid gap-2'>
                    <label htmlFor='password'>Password</label>
                    <Input
                      id='password'
                      name='password'
                      type='password'
                      placeholder='Enter password'
                      required
                    />
                  </div>
                </>
              )}
              {dialogType === 'update' && (
                <>
                  <div className='grid gap-2'>
                    <label htmlFor='name'>Admin Name</label>
                    <Input
                      id='name'
                      name='name'
                      placeholder='Enter name'
                      defaultValue={selected?.admin_name || ''}
                      required
                    />
                  </div>
                  <div className='grid gap-2'>
                    <label htmlFor='email'>Email</label>
                    <Input
                      id='email'
                      name='email'
                      type='email'
                      placeholder='Enter email'
                      defaultValue={selected?.admin_email || ''}
                      required
                    />
                  </div>
                  <div className='grid gap-2'>
                    <label htmlFor='password'>Password</label>
                    <Input
                      id='password'
                      name='password'
                      type='password'
                      placeholder='Leave blank to keep current password'
                    />
                  </div>
                </>
              )}
              <div className='grid gap-2'>
                <label htmlFor='class_id'>Class</label>
                <Select
                  name='class_id'
                  defaultValue={
                    selected?.class_id?.toString() || classes[0]?.id.toString()
                  }
                  required
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a class' />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
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
                {dialogType === 'create'
                  ? 'Create & Assign'
                  : 'Update Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the assignment for "
              {toDelete?.admin_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
