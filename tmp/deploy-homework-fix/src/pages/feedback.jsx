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
  MessageSquareIcon,
  EyeIcon,
  StarIcon,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

// Define the feedback statements structure
const feedbackStatements = {
  academic: [
    'My child has shown noticeable improvement in academic performance.',
    'The hybrid system has helped my child stay focused and organized.',
    'My child is completing assignments and homework more consistently.',
    'Teachers provide timely and effective academic support.',
    'The curriculum is well-balanced between in-person and online learning.',
  ],
  behavioral: [
    'My child has become more self-disciplined and responsible.',
    "There has been a positive change in my child's attitude toward learning.",
    'My child actively participates in both online and in-person sessions.',
    "The hybrid model supports my child's emotional and social development.",
    'My child is balancing screen time and physical activity effectively.',
  ],
  satisfaction: [
    'I am satisfied with the hybrid learning experience overall.',
    'Communication between the school and parents is clear and consistent.',
    'I would recommend this hybrid model to other parents.',
  ],
}

const sectionLabels = {
  academic: 'Academic',
  behavioral: 'Behavioral',
  satisfaction: 'Overall',
}

const ratingLabels = {
  1: 'Strongly Disagree',
  2: 'Disagree',
  3: 'Neutral',
  4: 'Agree',
  5: 'Strongly Agree',
}

export async function loader({ request }) {
  const user = await getUser(request)

  // Check if the user is a parent or superadmin
  const isParent = user.role_name === 'parent'
  const isSuperAdmin = user.role_name === 'super_admin'

  if (!isParent && !isSuperAdmin) {
    return {
      user,
      feedback: [],
      children: [],
      message:
        'Access denied. Only parents and administrators can access feedback.',
    }
  }

  let feedbackQuery = `
    SELECT f.id, f.title, f.description, f.created_at,
           f.parent_id, f.student_id, 
           p.name AS parent_name,
           s.name AS student_name
    FROM parent_feedback f
    JOIN users p ON f.parent_id = p.id
    JOIN users s ON f.student_id = s.id
  `

  const queryParams = []
  const whereConditions = []

  // If parent, only show own feedback
  if (isParent) {
    whereConditions.push('f.parent_id = ?')
    queryParams.push(user.id)
  }

  if (whereConditions.length > 0) {
    feedbackQuery += ` WHERE ${whereConditions.join(' AND ')}`
  }

  feedbackQuery += ` ORDER BY f.created_at DESC`

  const feedback = await query(feedbackQuery, queryParams)

  // Load feedback items for each feedback entry
  for (const item of feedback) {
    const feedbackItems = await query(
      `SELECT * FROM parent_feedback_items WHERE feedback_id = ? ORDER BY section, statement_id`,
      [item.id]
    )
    item.items = feedbackItems
  }

  // Get children for the parent
  let children = []

  if (isParent && user.student_ids && user.student_ids.length > 0) {
    // If user has student_ids array, use that
    const studentIds = user.student_ids
    const studentPlaceholders = studentIds.map(() => '?').join(',')

    const childrenQuery = `
      SELECT id, name 
      FROM users 
      WHERE id IN (${studentPlaceholders})
      ORDER BY name
    `

    const studentsResult = await query(childrenQuery, studentIds)
    children = studentsResult
  } else if (isSuperAdmin) {
    // If superadmin, get all students
    const studentsResult = await query(`
      SELECT id, name 
      FROM users 
      WHERE role_id = '5'
      ORDER BY name
    `)
    children = studentsResult
  }

  return { user, feedback, children }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')
  const user = await getUser(request)

  // Only parents can add feedback
  if (user.role_name !== 'parent' && user.role_name !== 'super_admin') {
    return {
      success: false,
      message: 'Access denied. Only parents can submit feedback.',
    }
  }

  try {
    if (action === 'create') {
      const title = formData.get('title')
      const student_id = formData.get('student_id')
      const parent_id = user.id

      // Insert the main feedback record
      const result = await query(
        `INSERT INTO parent_feedback (title, student_id, parent_id)
         VALUES (?, ?, ?)`,
        [title, student_id, parent_id]
      )

      const feedbackId = result.insertId

      // Process all feedback items from all sections
      const sections = ['academic', 'behavioral', 'satisfaction']

      for (const section of sections) {
        const statements = feedbackStatements[section]

        for (let i = 0; i < statements.length; i++) {
          const ratingKey = `${section}_rating_${i}`
          const commentKey = `${section}_comment_${i}`

          const rating = formData.get(ratingKey)
          const comment = formData.get(commentKey) || null

          if (rating) {
            await query(
              `INSERT INTO parent_feedback_items (feedback_id, section, statement_id, rating, comment)
               VALUES (?, ?, ?, ?, ?)`,
              [feedbackId, section, i, rating, comment]
            )
          }
        }
      }

      return { success: true, message: 'Feedback submitted successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const title = formData.get('title')
      const student_id = formData.get('student_id')

      // Update the main feedback record
      if (user.role_name === 'super_admin') {
        await query(
          `UPDATE parent_feedback
           SET title = ?, student_id = ?
           WHERE id = ?`,
          [title, student_id, id]
        )
      } else {
        await query(
          `UPDATE parent_feedback
           SET title = ?, student_id = ?
           WHERE id = ? AND parent_id = ?`,
          [title, student_id, id, user.id]
        )
      }

      // Delete all existing feedback items
      await query('DELETE FROM parent_feedback_items WHERE feedback_id = ?', [
        id,
      ])

      // Process all feedback items from all sections
      const sections = ['academic', 'behavioral', 'satisfaction']

      for (const section of sections) {
        const statements = feedbackStatements[section]

        for (let i = 0; i < statements.length; i++) {
          const ratingKey = `${section}_rating_${i}`
          const commentKey = `${section}_comment_${i}`

          const rating = formData.get(ratingKey)
          const comment = formData.get(commentKey) || null

          if (rating) {
            await query(
              `INSERT INTO parent_feedback_items (feedback_id, section, statement_id, rating, comment)
               VALUES (?, ?, ?, ?, ?)`,
              [id, section, i, rating, comment]
            )
          }
        }
      }

      return { success: true, message: 'Feedback updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')

      // Check if user is owner of feedback (parent) or superadmin
      if (user.role_name === 'super_admin') {
        await query(`DELETE FROM parent_feedback WHERE id = ?`, [id])
      } else {
        await query(
          `DELETE FROM parent_feedback WHERE id = ? AND parent_id = ?`,
          [id, user.id]
        )
      }

      return { success: true, message: 'Feedback deleted successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Feedback() {
  const { feedback, children, user, message } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState('create')
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [feedbackToDelete, setFeedbackToDelete] = useState(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [feedbackToView, setFeedbackToView] = useState(null)
  const [activeTab, setActiveTab] = useState('academic')

  // State for feedback ratings and comments
  const [ratings, setRatings] = useState({})

  const isParent = user.role_name === 'parent'
  const isSuperAdmin = user.role_name === 'super_admin'

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

  // Reset ratings when dialog is opened or closed
  useEffect(() => {
    if (openDialog && dialogType === 'create') {
      // Reset ratings for new feedback
      setRatings({})
      setActiveTab('academic')
    } else if (openDialog && dialogType === 'update' && selectedFeedback) {
      // Set ratings from existing feedback
      const newRatings = {}

      if (selectedFeedback.items) {
        selectedFeedback.items.forEach((item) => {
          const ratingKey = `${item.section}_rating_${item.statement_id}`
          const commentKey = `${item.section}_comment_${item.statement_id}`

          newRatings[ratingKey] = item.rating.toString()
          if (item.comment) {
            newRatings[commentKey] = item.comment
          }
        })
      }

      setRatings(newRatings)
      setActiveTab('academic')
    }
  }, [openDialog, dialogType, selectedFeedback])

  if (!isParent && !isSuperAdmin) {
    return (
      <div className='container mx-auto p-6 text-center'>
        <h2 className='text-xl font-semibold text-red-600 mb-4'>
          Access Denied
        </h2>
        <p>Only parents and administrators can access the feedback system.</p>
      </div>
    )
  }

  const handleCreateFeedback = () => {
    setDialogType('create')
    setSelectedFeedback(null)
    setOpenDialog(true)
  }

  const handleEditFeedback = (feedback) => {
    setDialogType('update')
    setSelectedFeedback(feedback)
    setOpenDialog(true)
  }

  const handleViewFeedback = (feedback) => {
    setFeedbackToView(feedback)
    setViewDialogOpen(true)
  }

  const openDeleteDialog = (feedback) => {
    setFeedbackToDelete(feedback)
    setDeleteDialogOpen(true)
  }

  const handleDeleteFeedback = () => {
    const fd = new FormData()
    fd.append('_action', 'delete')
    fd.append('id', feedbackToDelete.id)
    submit(fd, { method: 'post' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.append('_action', dialogType)
    if (dialogType === 'update' && selectedFeedback) {
      fd.append('id', selectedFeedback.id)
    }

    // Add all rating and comment values to the form data
    Object.keys(ratings).forEach((key) => {
      if (ratings[key]) {
        fd.append(key, ratings[key])
      }
    })

    submit(fd, { method: 'post' })
  }

  const handleRatingChange = (key, value) => {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  const handleCommentChange = (key, e) => {
    setRatings((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleNextTab = () => {
    if (activeTab === 'academic') {
      setActiveTab('behavioral')
    } else if (activeTab === 'behavioral') {
      setActiveTab('satisfaction')
    }
  }

  const canModify = (feedback) => {
    // Only allow parents to modify their own feedback
    return isParent && feedback.parent_id === user.id
  }

  // Render rating form for a section
  const renderRatingSection = (section, statements) => {
    return (
      <div className='grid gap-4'>
        {statements.map((statement, index) => {
          const ratingKey = `${section}_rating_${index}`
          const commentKey = `${section}_comment_${index}`
          const ratingValue = ratings[ratingKey] || ''
          const commentValue = ratings[commentKey] || ''

          return (
            <div key={ratingKey} className='border rounded-md p-4'>
              <div className='font-medium mb-2'>{statement}</div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <Label className='mb-2 block'>Rating (1-5)</Label>
                  <Select
                    value={ratingValue}
                    onValueChange={(value) =>
                      handleRatingChange(ratingKey, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select a rating' />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {value} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className='mb-2 block'>Comments (optional)</Label>
                  <Textarea
                    value={commentValue}
                    onChange={(e) => handleCommentChange(commentKey, e)}
                    placeholder='Add any additional comments here'
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const columns = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'student_name',
      header: 'Student',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.student_name}</div>
      ),
    },
    {
      accessorKey: 'parent_name',
      header: 'Parent',
      cell: ({ row }) => (
        <div className='text-center'>{row.original.parent_name}</div>
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
            onClick={() => handleViewFeedback(row.original)}
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
                onClick={() => handleEditFeedback(row.original)}
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
    data: feedback,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const dialogTitle =
    dialogType === 'create' ? 'Submit New Feedback' : 'Edit Feedback'

  const renderViewRatingSection = (section, items) => {
    if (!items || items.length === 0) return null

    const sectionItems = items.filter((item) => item.section === section)
    if (sectionItems.length === 0) return null

    return (
      <div className='space-y-4'>
        {feedbackStatements[section].map((statement, index) => {
          const item = sectionItems.find(
            (i) => parseInt(i.statement_id) === index
          )
          if (!item) return null

          return (
            <div
              key={`view_${section}_${index}`}
              className='border rounded-md p-4'
            >
              <p className='font-medium'>{statement}</p>
              <div className='flex items-center mt-2'>
                <div className='flex items-center'>
                  <span className='font-semibold mr-2'>Rating:</span>
                  <div className='flex'>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        className={`h-5 w-5 ${
                          star <= parseInt(item.rating)
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className='ml-2 text-sm text-gray-600'>
                    ({item.rating} - {ratingLabels[parseInt(item.rating)]})
                  </span>
                </div>
              </div>
              {item.comment && (
                <div className='mt-2'>
                  <span className='font-semibold'>Comment:</span>
                  <p className='text-sm mt-1 text-gray-700'>{item.comment}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Parent Feedback</h1>
        {isParent && (
          <Button onClick={handleCreateFeedback} className='w-full sm:w-auto'>
            <PlusIcon className='mr-2 h-4 w-4' />
            <span>Submit Feedback</span>
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
                  No feedback found.
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
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === 'create'
                ? 'Fill out the form below to submit new feedback.'
                : 'Update your feedback information.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-6 pb-4'>
              <div className='grid gap-2'>
                <label htmlFor='title'>Title</label>
                <Input
                  id='title'
                  name='title'
                  placeholder='Enter feedback title'
                  defaultValue={selectedFeedback?.title || ''}
                  required
                />
              </div>

              <div className='grid gap-2'>
                <label htmlFor='student_id'>Student</label>
                <Select
                  name='student_id'
                  defaultValue={selectedFeedback?.student_id?.toString() || ''}
                  required
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a student' />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id.toString()}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='mt-4'>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className='grid w-full grid-cols-3'>
                    <TabsTrigger value='academic'>Academic</TabsTrigger>
                    <TabsTrigger value='behavioral'>Behavioral</TabsTrigger>
                    <TabsTrigger value='satisfaction'>Overall</TabsTrigger>
                  </TabsList>

                  <TabsContent value='academic' className='mt-4'>
                    <div className='mb-4'>
                      <h3 className='text-lg font-semibold'>
                        {sectionLabels.academic}
                      </h3>
                      <p className='text-sm text-gray-500 mt-1'>
                        Please rate each statement from 1-5 (1: Strongly
                        Disagree to 5: Strongly Agree)
                      </p>
                    </div>
                    {renderRatingSection(
                      'academic',
                      feedbackStatements.academic
                    )}
                    <div className='flex justify-end mt-4'>
                      <Button type='button' onClick={handleNextTab}>
                        Next
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value='behavioral' className='mt-4'>
                    <div className='mb-4'>
                      <h3 className='text-lg font-semibold'>
                        {sectionLabels.behavioral}
                      </h3>
                      <p className='text-sm text-gray-500 mt-1'>
                        Please rate each statement from 1-5 (1: Strongly
                        Disagree to 5: Strongly Agree)
                      </p>
                    </div>
                    {renderRatingSection(
                      'behavioral',
                      feedbackStatements.behavioral
                    )}
                    <div className='flex justify-end mt-4'>
                      <Button type='button' onClick={handleNextTab}>
                        Next
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value='satisfaction' className='mt-4'>
                    <div className='mb-4'>
                      <h3 className='text-lg font-semibold'>
                        {sectionLabels.satisfaction}
                      </h3>
                      <p className='text-sm text-gray-500 mt-1'>
                        Please rate each statement from 1-5 (1: Strongly
                        Disagree to 5: Strongly Agree)
                      </p>
                    </div>
                    {renderRatingSection(
                      'satisfaction',
                      feedbackStatements.satisfaction
                    )}
                    <div className='flex justify-end gap-2 mt-6'>
                      <Button
                        variant='outline'
                        onClick={() => setOpenDialog(false)}
                        type='button'
                      >
                        Cancel
                      </Button>
                      <Button type='submit'>
                        {dialogType === 'create'
                          ? 'Submit Feedback'
                          : 'Update Feedback'}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the feedback "
              {feedbackToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFeedback}
              className='bg-destructive hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MessageSquareIcon className='h-5 w-5' />
              <span>Feedback Details</span>
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
                value={feedbackToView?.title}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor='student' className='text-sm font-medium'>
                Student
              </Label>
              <Input
                type='text'
                id='student'
                value={feedbackToView?.student_name}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor='parent' className='text-sm font-medium'>
                Parent
              </Label>
              <Input
                type='text'
                id='parent'
                value={feedbackToView?.parent_name}
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
                value={new Date(feedbackToView?.created_at).toLocaleString()}
                readOnly
              />
            </div>

            <div className='col-span-2 mt-4'>
              <Tabs defaultValue='academic'>
                <TabsList className='grid w-full grid-cols-3'>
                  <TabsTrigger value='academic'>
                    {sectionLabels.academic}
                  </TabsTrigger>
                  <TabsTrigger value='behavioral'>
                    {sectionLabels.behavioral}
                  </TabsTrigger>
                  <TabsTrigger value='satisfaction'>
                    {sectionLabels.satisfaction}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value='academic' className='mt-4'>
                  {renderViewRatingSection('academic', feedbackToView?.items)}
                </TabsContent>

                <TabsContent value='behavioral' className='mt-4'>
                  {renderViewRatingSection('behavioral', feedbackToView?.items)}
                </TabsContent>

                <TabsContent value='satisfaction' className='mt-4'>
                  {renderViewRatingSection(
                    'satisfaction',
                    feedbackToView?.items
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
