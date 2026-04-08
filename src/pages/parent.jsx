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
import { PencilIcon, TrashIcon, PlusIcon, UserIcon } from 'lucide-react'

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
  const parents = await query(
    `SELECT id, name, email, created_at FROM users WHERE role_id = ?`,
    [6]
  )
  const students = await query(
    `SELECT id, name, email FROM users WHERE role_id = ?`,
    [5]
  )
  const links = await query(
    `SELECT psl.id, psl.parent_id, psl.student_id, s.name AS student_name, s.email AS student_email
     FROM parent_student_links psl
     JOIN users s ON psl.student_id = s.id`
  )

  const parentStudentLinks = {}
  links.forEach((ln) => {
    if (!parentStudentLinks[ln.parent_id]) parentStudentLinks[ln.parent_id] = []
    parentStudentLinks[ln.parent_id].push({
      id: ln.id,
      student_id: ln.student_id,
      student_name: ln.student_name,
      student_email: ln.student_email,
    })
  })

  return { parents, students, parentStudentLinks }
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
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 6)`,
        [name, email, passwordHash]
      )
      return { success: true, message: 'Parent created successfully' }
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
      return { success: true, message: 'Parent updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')
      await query(`DELETE FROM parent_student_links WHERE parent_id = ?`, [id])
      await query(`DELETE FROM users WHERE id = ?`, [id])
      return { success: true, message: 'Parent deleted successfully' }
    }

    if (action === 'link_student') {
      const parent_id = formData.get('parent_id')
      const student_id = formData.get('student_id')

      const existing = await query(
        `SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?`,
        [parent_id, student_id]
      )
      if (existing.length > 0) {
        return {
          success: false,
          message: 'This student is already linked to this parent.',
        }
      }
      await query(
        `INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)`,
        [parent_id, student_id]
      )
      return { success: true, message: 'Student linked successfully' }
    }

    if (action === 'remove_link') {
      const link_id = formData.get('link_id')
      await query(`DELETE FROM parent_student_links WHERE id = ?`, [link_id])
      return { success: true, message: 'Student link removed successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Parent() {
  const { parents, students, parentStudentLinks } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedParent, setSelectedParent] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [parentToDelete, setParentToDelete] = useState(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [currentParentId, setCurrentParentId] = useState(null)

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success(actionData.message)
        setOpenDialog(false)
        setLinkDialogOpen(false)
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  const handleCreateParent = () => {
    setDialogType('create')
    setSelectedParent(null)
    setOpenDialog(true)
  }

  const handleEditParent = (parent) => {
    setDialogType('update')
    setSelectedParent(parent)
    setOpenDialog(true)
  }

  const openDeleteDialog = (parent) => {
    setParentToDelete(parent)
    setDeleteDialogOpen(true)
  }

  const handleDeleteParent = () => {
    const formData = new FormData()
    formData.append('_action', 'delete')
    formData.append('id', parentToDelete.id)
    submit(formData, { method: 'post' })
    setDeleteDialogOpen(false)
  }

  const handleLinkStudent = (parentId) => {
    setCurrentParentId(parentId)
    setLinkDialogOpen(true)
  }

  const handleRemoveLink = (linkId) => {
    const formData = new FormData()
    formData.append('_action', 'remove_link')
    formData.append('link_id', linkId)
    submit(formData, { method: 'post' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('_action', dialogType)
    if (dialogType === 'update' && selectedParent) {
      formData.append('id', selectedParent.id)
    }
    submit(formData, { method: 'post' })
  }

  const submitLink = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('_action', 'link_student')
    formData.append('parent_id', currentParentId)
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
      id: 'students',
      header: 'Linked Students',
      cell: ({ row }) => {
        const pid = row.original.id
        const linked = parentStudentLinks[pid] || []
        return (
          <div className='flex flex-wrap gap-1 justify-center'>
            {linked.length > 0 ? (
              linked.map((ln) => (
                <Badge
                  key={ln.id}
                  variant='secondary'
                  className='flex items-center gap-1'
                >
                  {ln.student_name}
                  <button
                    className='ml-1 text-xs hover:text-destructive'
                    onClick={() => handleRemoveLink(ln.id)}
                  >
                    ×
                  </button>
                </Badge>
              ))
            ) : (
              <span className='text-muted-foreground text-sm'>
                No students linked
              </span>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleLinkStudent(pid)}
              className='mt-1 h-6'
            >
              <PlusIcon className='h-3 w-3' />
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
        <div className='flex justify-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleEditParent(row.original)}
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
    data: parents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Create New Parent' : 'Edit Parent'

  return (
    <div className='container mx-auto pb-10'>
      <div className='flex justify-between items-center mb-6'>
        <span className='ml-2 pt-2 text-xl font-semibold'>Manage Parents</span>
        <Button onClick={handleCreateParent}>
          <PlusIcon className='mr-2 h-4 w-4' />
          <span>Add Parent</span>
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className='text-center'>
                    {!header.isPlaceholder &&
                      flexRender(
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
                  No parents found.
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

      {/* Create/Edit Parent Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to create a new parent account.'
                : 'Update the parent information.'}
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
                  defaultValue={selectedParent?.name || ''}
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
                  defaultValue={selectedParent?.email || ''}
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
                {dialogType === 'create' ? 'Create Parent' : 'Update Parent'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Parent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete parent "{parentToDelete?.name}"?
              This will also remove all student links for this parent. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteParent}
              className='bg-destructive hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Student Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Student</DialogTitle>
            <DialogDescription>
              Select a student to link to this parent.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitLink}>
            <div className='grid gap-4 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='student_id'>Student</label>
                <Select name='student_id' required>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a student' />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((st) => (
                      <SelectItem key={st.id} value={st.id.toString()}>
                        {st.name} ({st.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setLinkDialogOpen(false)}
                type='button'
              >
                Cancel
              </Button>
              <Button type='submit'>Link Student</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
