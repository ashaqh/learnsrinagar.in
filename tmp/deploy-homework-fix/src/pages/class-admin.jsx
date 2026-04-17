import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { query, transaction } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  useLoaderData,
  useSubmit,
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

  const users = await query('SELECT id, name FROM users WHERE role_id = ?', [
    3,
  ])
  const schools = schoolId
    ? await query('SELECT id, name FROM schools WHERE id = ?', [schoolId])
    : await query('SELECT id, name FROM schools')
  const classes = schoolId
    ? await query('SELECT id, name FROM classes WHERE school_id = ?', [schoolId])
    : await query('SELECT id, name FROM classes')

  let classAdminsSql = `
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
  `
  const classAdminParams = []

  if (schoolId) {
    classAdminsSql += ' WHERE ca.school_id = ?'
    classAdminParams.push(schoolId)
  }

  const classAdmins = await query(classAdminsSql, classAdminParams)

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
      const school_id = await resolveEffectiveSchoolId(user)
      const class_id = formData.get('class_id')
      let admin_id = null

      if (!school_id) {
        return {
          success: false,
          message: 'Your account is not linked to a school yet.',
        }
      }

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

        // Use transaction helper
        await transaction(async (q) => {
          // Create user
          const salt = await bcrypt.genSalt(10)
          const password_hash = await bcrypt.hash(password, salt)
          const result = await q(
            'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 3)',
            [name, email, password_hash]
          )

          // Get the inserted ID
          admin_id = result.insertId

          // Create class admin assignment
          await q(
            'INSERT INTO class_admins (admin_id, school_id, class_id) VALUES (?, ?, ?)',
            [admin_id, school_id, class_id]
          )
        })

        try {
          const { notificationService } = await import('@/services/notificationService.server')
          const { getClassAdminLifecycleNotification } = await import(
            '@/services/notificationHelper.server'
          )
          const message = await getClassAdminLifecycleNotification({
            action: 'created',
            adminName: name,
            classId: class_id,
            schoolId: school_id,
          })

          await notificationService.sendNotification({
            title: 'New Class Admin Assigned',
            message,
            eventType: 'CLASS_ADMIN_ASSIGNED',
            targetType: 'school',
            targetId: school_id,
            metadata: {
              adminId: admin_id,
              adminName: name,
              classId: String(class_id),
              schoolId: String(school_id),
            },
            senderId: user?.id,
          })
        } catch (notifyError) {
          console.error('Failed to send class admin creation notification:', notifyError)
        }

        return {
          success: true,
          message: 'Class admin created and assigned successfully',
        }
      } catch (err) {
        throw err
      }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const name = formData.get('name')
      const email = formData.get('email')
      const password = formData.get('password')
      const school_id = await resolveEffectiveSchoolId(user)
      const class_id = formData.get('class_id')

      if (!school_id) {
        return {
          success: false,
          message: 'Your account is not linked to a school yet.',
        }
      }

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
        // Use transaction helper
        await transaction(async (q) => {
          // Update user details
          if (password && password.trim() !== '') {
            // Update with new password
            const salt = await bcrypt.genSalt(10)
            const password_hash = await bcrypt.hash(password, salt)
            await q(
              `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
              [name, email, password_hash, admin_id]
            )
          } else {
            // Update without changing password
            await q(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [
              name,
              email,
              admin_id,
            ])
          }

          // Update class assignment
          const exists = await q(
            `SELECT id
             FROM class_admins
             WHERE admin_id = ? AND school_id = ? AND class_id = ? AND id != ?`,
            [admin_id, school_id, class_id, id]
          )

          if (exists.length > 0) {
            throw new Error('This assignment already exists.')
          }

          await q(
            `UPDATE class_admins
             SET school_id = ?, class_id = ?
             WHERE id = ?`,
            [school_id, class_id, id]
          )
        })

        return {
          success: true,
          message: 'Class admin updated successfully',
        }
      } catch (err) {
        throw err
      }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      const existingAssignment = await query(
        `
          SELECT ca.school_id, ca.class_id, u.name AS admin_name
          FROM class_admins ca
          JOIN users u ON ca.admin_id = u.id
          WHERE ca.id = ?
        `,
        [id]
      )

      if (existingAssignment.length === 0) {
        return { success: false, message: 'Assignment not found' }
      }

      const schoolId = await resolveEffectiveSchoolId(user)
      if (
        schoolId &&
        String(existingAssignment[0].school_id) !== String(schoolId)
      ) {
        return { success: false, message: 'You can only manage your school.' }
      }

      await query('DELETE FROM class_admins WHERE id = ?', [id])

      try {
        const { notificationService } = await import('@/services/notificationService.server')
        const { getClassAdminLifecycleNotification } = await import(
          '@/services/notificationHelper.server'
        )
        const assignment = existingAssignment[0]
        const message = await getClassAdminLifecycleNotification({
          action: 'deleted',
          adminName: assignment.admin_name,
          classId: assignment.class_id,
          schoolId: assignment.school_id,
        })

        await notificationService.sendNotification({
          title: 'Class Admin Removed',
          message,
          eventType: 'CLASS_ADMIN_REMOVED',
          targetType: 'school',
          targetId: assignment.school_id,
          metadata: {
            adminName: assignment.admin_name,
            classId: String(assignment.class_id),
            schoolId: String(assignment.school_id),
          },
          senderId: user?.id,
        })
      } catch (notifyError) {
        console.error('Failed to send class admin deletion notification:', notifyError)
      }

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

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selected, setSelected] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState('')

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
    setSelectedClassId(classes[0]?.id?.toString() || '')
    setOpenDialog(true)
  }
  const handleEdit = (assignment) => {
    setDialogType('update')
    setSelected(assignment)
    setSelectedClassId(assignment?.class_id?.toString() || '')
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
              <input type='hidden' name='class_id' value={selectedClassId} />
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
                  value={selectedClassId}
                  onValueChange={setSelectedClassId}
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
