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
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import {
  CalendarIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from 'lucide-react'
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

export async function loader({ request }) {
  const user = await getUser(request)

  // Build attendance query with potential filters based on user permissions
  let attendanceQuery = `
    SELECT sa.id, sa.student_id, sa.class_id, sa.date, sa.status, sa.created_at,
           u.name as student_name, c.name as class_name
    FROM student_attendance sa
    JOIN users u ON sa.student_id = u.id
    JOIN classes c ON sa.class_id = c.id
    LEFT JOIN student_profiles sp ON sa.student_id = sp.user_id
  `

  const attendanceQueryParams = []
  const attendanceWhereConditions = []

  // Filter by class_ids if user has them
  if (user.class_ids && user.class_ids.length > 0) {
    attendanceWhereConditions.push(
      `sa.class_id IN (${user.class_ids.map(() => '?').join(',')})`
    )
    attendanceQueryParams.push(...user.class_ids)
  }

  // Filter by school_id if user has it
  if (user.school_id) {
    attendanceWhereConditions.push('sp.schools_id = ?')
    attendanceQueryParams.push(user.school_id)
  }

  // Add WHERE conditions to the query if needed
  if (attendanceWhereConditions.length > 0) {
    attendanceQuery += ` WHERE ${attendanceWhereConditions.join(' AND ')}`
  }

  // Add ORDER BY clause
  attendanceQuery += ` ORDER BY sa.date DESC, c.name, u.name`

  const attendance = await query(attendanceQuery, attendanceQueryParams)

  // Get all students with similar filtering
  let studentsQuery = `
    SELECT u.id, u.name, sp.class_id, c.name as class_name
    FROM users u
    JOIN student_profiles sp ON u.id = sp.user_id
    JOIN classes c ON sp.class_id = c.id
    WHERE u.role_id = 5
  `

  const studentsQueryParams = []
  const studentsWhereConditions = []

  // Filter by class_ids if user has them
  if (user.class_ids && user.class_ids.length > 0) {
    studentsWhereConditions.push(
      `sp.class_id IN (${user.class_ids.map(() => '?').join(',')})`
    )
    studentsQueryParams.push(...user.class_ids)
  }

  // Filter by school_id if user has it
  if (user.school_id) {
    studentsWhereConditions.push('sp.schools_id = ?')
    studentsQueryParams.push(user.school_id)
  }

  // Add WHERE conditions to the query if needed
  if (studentsWhereConditions.length > 0) {
    studentsQuery += ` AND ${studentsWhereConditions.join(' AND ')}`
  }

  studentsQuery += ` ORDER BY c.name, u.name`

  const students = await query(studentsQuery, studentsQueryParams)

  // Get all classes or filter by user's class_ids if they exist
  let classesQuery = `SELECT id, name FROM classes`
  const classQueryParams = []

  if (user.class_ids && user.class_ids.length > 0) {
    classesQuery += ` WHERE id IN (${user.class_ids.map(() => '?').join(',')})`
    classQueryParams.push(...user.class_ids)
  }

  classesQuery += ` ORDER BY name`

  const classes = await query(classesQuery, classQueryParams)

  return {
    user,
    attendance,
    students,
    classes,
  }
}

export async function action({ request }) {
  const formData = await request.formData()
  const action = formData.get('_action')
  const user = await getUser(request)

  // Only allow class_admin to modify attendance
  if (user.role_name !== 'class_admin') {
    return {
      success: false,
      message: 'Only class admins can modify attendance records.',
    }
  }

  try {
    if (action === 'create') {
      const studentId = formData.get('student_id')
      const classId = formData.get('class_id')
      const date = formData.get('date')
      const status = formData.get('status')

      // Check if attendance record already exists for this student, class, and date
      const existingRecord = await query(
        'SELECT id FROM student_attendance WHERE student_id = ? AND class_id = ? AND date = ?',
        [studentId, classId, date]
      )

      if (existingRecord.length > 0) {
        return {
          success: false,
          message:
            'An attendance record already exists for this student on the selected date.',
        }
      }

      // Insert new attendance record
      await query(
        'INSERT INTO student_attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)',
        [studentId, classId, date, status]
      )

      return { success: true, message: 'Attendance recorded successfully' }
    }

    if (action === 'update') {
      const id = formData.get('id')
      const studentId = formData.get('student_id')
      const classId = formData.get('class_id')
      const date = formData.get('date')
      const status = formData.get('status')

      // Check if attendance record already exists for this student, class, and date (excluding current record)
      const existingRecord = await query(
        'SELECT id FROM student_attendance WHERE student_id = ? AND class_id = ? AND date = ? AND id != ?',
        [studentId, classId, date, id]
      )

      if (existingRecord.length > 0) {
        return {
          success: false,
          message:
            'An attendance record already exists for this student on the selected date.',
        }
      }

      // Update attendance record
      await query(
        'UPDATE student_attendance SET student_id = ?, class_id = ?, date = ?, status = ? WHERE id = ?',
        [studentId, classId, date, status, id]
      )

      return { success: true, message: 'Attendance updated successfully' }
    }

    if (action === 'delete') {
      const id = formData.get('id')

      // Delete attendance record
      await query('DELETE FROM student_attendance WHERE id = ?', [id])

      return {
        success: true,
        message: 'Attendance record deleted successfully',
      }
    }

    if (action === 'bulk_create') {
      const classId = formData.get('class_id')
      const date = formData.get('date')
      const studentIds = formData.getAll('student_ids')
      const statuses = formData.getAll('statuses')

      // Process each student attendance record
      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i]
        const status = statuses[i]

        // Check if attendance record already exists
        const existingRecord = await query(
          'SELECT id FROM student_attendance WHERE student_id = ? AND class_id = ? AND date = ?',
          [studentId, classId, date]
        )

        if (existingRecord.length > 0) {
          // Update existing record
          await query(
            'UPDATE student_attendance SET status = ? WHERE student_id = ? AND class_id = ? AND date = ?',
            [status, studentId, classId, date]
          )
        } else {
          // Insert new record
          await query(
            'INSERT INTO student_attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)',
            [studentId, classId, date, status]
          )
        }
      }

      return { success: true, message: 'Attendance recorded successfully' }
    }

    return { success: false, message: 'Invalid action' }
  } catch (error) {
    return { success: false, message: error.message || 'An error occurred' }
  }
}

export default function Attendance() {
  const { attendance, students, classes, user } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const navigate = useNavigate()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedClass, setSelectedClass] = useState('')
  const [filteredStudents, setFilteredStudents] = useState([])
  const [studentAttendance, setStudentAttendance] = useState({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState(null)
  const [tableData, setTableData] = useState([])

  // Format date for API
  const formattedDate = format(selectedDate, 'yyyy-MM-dd')

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success(actionData.message)
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  // Load students when class changes
  useEffect(() => {
    if (selectedClass) {
      const classStudents = students.filter(
        (student) => student.class_id.toString() === selectedClass
      )
      setFilteredStudents(classStudents)
    } else if (classes.length > 0) {
      // Default to first class if none selected
      setSelectedClass(classes[0].id.toString())
    } else {
      setFilteredStudents([])
    }
  }, [selectedClass, students, classes])

  // Initialize attendance status for all students on date/class change
  useEffect(() => {
    const initialAttendance = {}

    // Get today's attendance records
    const todaysRecords = attendance.filter((record) => {
      // Handle date comparison safely by checking the type first
      if (typeof record.date === 'string') {
        return record.date.substring(0, 10) === formattedDate
      } else if (record.date instanceof Date) {
        return format(record.date, 'yyyy-MM-dd') === formattedDate
      }
      return false
    })

    filteredStudents.forEach((student) => {
      // Find if student has attendance record for this date
      const existingRecord = todaysRecords.find(
        (record) =>
          record.student_id === student.id &&
          record.class_id.toString() === selectedClass
      )

      if (existingRecord) {
        initialAttendance[student.id] = {
          status: existingRecord.status,
          recordId: existingRecord.id,
        }
      } else {
        initialAttendance[student.id] = {
          status: 'not_marked',
          recordId: null,
        }
      }
    })

    setStudentAttendance(initialAttendance)
  }, [filteredStudents, selectedDate, attendance, selectedClass, formattedDate])

  // Update tableData whenever students or attendance status changes
  useEffect(() => {
    const newTableData = filteredStudents.map((student) => ({
      id: student.id,
      name: student.name,
      class_name: student.class_name,
      attendanceStatus: studentAttendance[student.id]?.status || 'not_marked',
      recordId: studentAttendance[student.id]?.recordId || null,
    }))

    setTableData(newTableData)
  }, [filteredStudents, studentAttendance])

  const markAttendance = (studentId, status) => {
    const formData = new FormData()
    const existingRecord = studentAttendance[studentId]

    if (existingRecord && existingRecord.recordId) {
      formData.append('_action', 'update')
      formData.append('id', existingRecord.recordId)
    } else {
      formData.append('_action', 'create')
    }

    formData.append('student_id', studentId)
    formData.append('class_id', selectedClass)
    formData.append('date', formattedDate)
    formData.append('status', status)

    submit(formData, { method: 'post' })

    // Optimistically update UI
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: status,
      },
    }))
  }

  const openDeleteDialog = (studentId) => {
    const studentData = filteredStudents.find((s) => s.id === studentId)

    if (studentAttendance[studentId]?.recordId) {
      setRecordToDelete({
        id: studentAttendance[studentId].recordId,
        student_name: studentData?.name || 'Student',
        date: formattedDate,
      })
      setDeleteDialogOpen(true)
    } else {
      toast.error('No attendance record exists to delete')
    }
  }

  const handleDeleteAttendance = () => {
    const formData = new FormData()
    formData.append('_action', 'delete')
    formData.append('id', recordToDelete.id)

    submit(formData, { method: 'post' })
    setDeleteDialogOpen(false)

    // Optimistically update UI
    const studentId = Object.keys(studentAttendance).find(
      (id) => studentAttendance[id].recordId === recordToDelete.id
    )

    if (studentId) {
      setStudentAttendance((prev) => ({
        ...prev,
        [studentId]: {
          status: 'not_marked',
          recordId: null,
        },
      }))
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'present':
        return (
          <span className='inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700'>
            <CheckCircleIcon className='mr-1 h-3 w-3' />
            Present
          </span>
        )
      case 'absent':
        return (
          <span className='inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700'>
            <XCircleIcon className='mr-1 h-3 w-3' />
            Absent
          </span>
        )
      case 'late':
        return (
          <span className='inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700'>
            <ClockIcon className='mr-1 h-3 w-3' />
            Late
          </span>
        )
      default:
        return (
          <span className='inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700'>
            Not marked
          </span>
        )
    }
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'Student',
      cell: ({ row }) => <div className='text-center'>{row.original.name}</div>,
    },
    {
      accessorKey: 'attendanceStatus',
      header: 'Status',
      cell: ({ row }) => (
        <div className='text-center'>
          {getStatusBadge(row.original.attendanceStatus)}
        </div>
      ),
    },
    {
      id: 'markAttendance',
      header: 'Mark Attendance',
      cell: ({ row }) => (
        <div className='flex flex-col sm:flex-row justify-center gap-1 sm:gap-2'>
          {user.role_name === 'class_admin' ? (
            <>
              <Button
                variant={
                  row.original.attendanceStatus === 'present'
                    ? 'default'
                    : 'outline'
                }
                size='sm'
                onClick={() => markAttendance(row.original.id, 'present')}
                className='text-xs sm:text-sm'
              >
                <CheckCircleIcon className='mr-1 size-3 sm:size-4' />
                <span className='hidden sm:inline'>Present</span>
                <span className='sm:hidden'>P</span>
              </Button>
              <Button
                variant={
                  row.original.attendanceStatus === 'absent'
                    ? 'default'
                    : 'outline'
                }
                size='sm'
                onClick={() => markAttendance(row.original.id, 'absent')}
                className='text-xs sm:text-sm'
              >
                <XCircleIcon className='mr-1 size-3 sm:size-4' />
                <span className='hidden sm:inline'>Absent</span>
                <span className='sm:hidden'>A</span>
              </Button>
              <Button
                variant={
                  row.original.attendanceStatus === 'late'
                    ? 'default'
                    : 'outline'
                }
                size='sm'
                onClick={() => markAttendance(row.original.id, 'late')}
                className='text-xs sm:text-sm'
              >
                <ClockIcon className='mr-1 size-3 sm:size-4' />
                <span className='hidden sm:inline'>Late</span>
                <span className='sm:hidden'>L</span>
              </Button>
            </>
          ) : (
            <span className='text-xs sm:text-sm text-gray-500 italic'>
              Only class admins can mark attendance
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex justify-center gap-2'>
          {user.role_name === 'class_admin' ? (
            <Button
              variant='outline'
              size='sm'
              onClick={() => openDeleteDialog(row.original.id)}
              disabled={!row.original.recordId}
            >
              <TrashIcon className='size-4' />
            </Button>
          ) : (
            <span className='text-sm text-gray-500'>-</span>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Attendance</h1>
        <div className='flex flex-col sm:flex-row gap-3'>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className='w-full sm:w-[200px]'>
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

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                className='w-full sm:w-auto justify-start text-left font-normal'
              >
                <CalendarIcon className='mr-2 h-4 w-4 flex-shrink-0' />
                <span className='truncate'>
                  {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select date'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='end'>
              <Calendar
                mode='single'
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {tableData.length > 0 ? (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className='text-center whitespace-nowrap'>
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
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className='rounded-md border p-8 text-center'>
          {selectedClass
            ? 'No students found in this class'
            : 'Please select a class'}
        </div>
      )}

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className='text-center'>
            <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attendance record for{' '}
              <strong>{recordToDelete?.student_name}</strong> on{' '}
              {recordToDelete?.date && (
                <strong>
                  {new Date(recordToDelete.date).toLocaleDateString()}
                </strong>
              )}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end'>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAttendance}
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
