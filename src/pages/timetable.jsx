import { useState, useEffect } from 'react'
import { query } from '@/lib/db'
import { useLoaderData } from '@remix-run/react'
import { format, isSameDay } from 'date-fns'
import { getUser } from '@/lib/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VideoIcon, CalendarIcon, Youtube } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export async function loader({ request }) {
  const user = await getUser(request)

  const liveClasses = await query(`
    SELECT z.*,
           IFNULL(s.name, z.topic_name) AS subject_name,
           c.name AS class_name,
           z.class_id,
           u.name AS teacher_name
    FROM live_classes z
    LEFT JOIN subjects s  ON z.subject_id = s.id
    JOIN classes c   ON z.class_id   = c.id
    JOIN users u     ON z.teacher_id = u.id
    ORDER BY z.start_time ASC
  `)

  return { liveClasses, user }
}

export default function Timetable() {
  const { liveClasses, user } = useLoaderData()
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [timeSlots, setTimeSlots] = useState([])
  const [classesData, setClassesData] = useState([])
  const [teachersData, setTeachersData] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState('all')
  const [classTimeTable, setClassTimeTable] = useState({})
  const isTeacher = user && user.role_name === 'teacher'

  // Check if user has permission to join class (super_admin, school_admin, class_admin, teacher)
  // Everyone can join classes now
  const canJoinClass = true

  useEffect(() => {
    // Filter classes by selected date
    const selectedDateObj = new Date(selectedDate)
    let filteredClasses = liveClasses.filter((cls) => {
      const classDate = new Date(cls.start_time)
      return isSameDay(classDate, selectedDateObj)
    })

    // Role-based and class-based filtering removed for universal access

    // If not a teacher and a specific teacher is selected, filter by that teacher
    if (selectedTeacher !== 'all') {
      filteredClasses = filteredClasses.filter(
        (zc) => zc.teacher_id.toString() === selectedTeacher
      )
    }

    // Sort classes by time
    filteredClasses.sort((a, b) => {
      const timeA = new Date(a.start_time).getTime()
      const timeB = new Date(b.start_time).getTime()
      return timeA - timeB
    })

    // Extract unique teachers (only if not in teacher view)
    if (!isTeacher) {
      const uniqueTeachers = []
      const teacherMap = new Map()

      liveClasses.forEach((cls) => {
        if (!teacherMap.has(cls.teacher_id)) {
          teacherMap.set(cls.teacher_id, {
            id: cls.teacher_id,
            name: cls.teacher_name,
          })
          uniqueTeachers.push({
            id: cls.teacher_id,
            name: cls.teacher_name,
          })
        }
      })

      // Sort teachers by name
      uniqueTeachers.sort((a, b) => a.name.localeCompare(b.name))
      setTeachersData(uniqueTeachers)
    }

    // Extract unique time slots
    const uniqueTimeSlots = []
    const timeSlotMap = new Map()

    filteredClasses.forEach((cls) => {
      // Create a Date object
      const startTime = new Date(cls.start_time)
      const endTime = new Date(cls.end_time)

      const timeKey = `${format(startTime, 'h:mm a')} - ${format(
        endTime,
        'h:mm a'
      )}`

      if (!timeSlotMap.has(timeKey)) {
        timeSlotMap.set(timeKey, {
          key: timeKey,
          startTime,
          endTime,
          formattedTime: timeKey,
        })
        uniqueTimeSlots.push({
          key: timeKey,
          startTime,
          endTime,
          formattedTime: timeKey,
        })
      }
    })

    // Sort time slots chronologically
    uniqueTimeSlots.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    )
    setTimeSlots(uniqueTimeSlots)

    // Extract unique classes
    const uniqueClasses = []
    const classMap = new Map()

    filteredClasses.forEach((cls) => {
      if (!classMap.has(cls.class_id)) {
        classMap.set(cls.class_id, {
          id: cls.class_id,
          name: cls.class_name,
        })
        uniqueClasses.push({
          id: cls.class_id,
          name: cls.class_name,
        })
      }
    })

    // Sort classes by name
    uniqueClasses.sort((a, b) => a.name.localeCompare(b.name))
    setClassesData(uniqueClasses)

    // Create timetable data structure
    const timetable = {}
    uniqueClasses.forEach((cls) => {
      timetable[cls.id] = {}
      uniqueTimeSlots.forEach((slot) => {
        timetable[cls.id][slot.key] = null
      })
    })

    // Fill in timetable with class data
    filteredClasses.forEach((cls) => {
      const startTime = new Date(cls.start_time)
      const endTime = new Date(cls.end_time)

      const timeKey = `${format(startTime, 'h:mm a')} - ${format(
        endTime,
        'h:mm a'
      )}`

        timetable[cls.class_id][timeKey] = {
        id: cls.id,
        subject: cls.subject_name,
        teacher: cls.teacher_name,
        startTime,
        endTime,
        joinUrl: cls.youtube_live_link,
        zoomLink: cls.zoom_link,
        description: cls.topic_name,
      }
    })

    setClassTimeTable(timetable)
  }, [liveClasses, selectedDate, user, isTeacher, selectedTeacher])

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col gap-4 mb-6'>
        <h1 className='text-xl font-semibold'>Class Schedule</h1>
        
        <div className='flex flex-col sm:flex-row gap-3'>
          <Input
            type='date'
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className='w-full sm:w-[200px]'
          />

          {!isTeacher && teachersData.length > 0 && (
            <Select
              value={selectedTeacher}
              onValueChange={(value) => setSelectedTeacher(value)}
            >
              <SelectTrigger className='w-full sm:w-[240px]'>
                <SelectValue placeholder='Filter by Teacher' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Teachers</SelectItem>
                {teachersData.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id.toString()}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Display selected date */}
      <div className='mb-4 p-3 bg-gray-50 rounded-lg'>
        <span className='font-medium text-gray-700 text-sm sm:text-base'>
          Schedule: {format(new Date(selectedDate), 'dd/MM/yyyy')}
        </span>
      </div>

      {timeSlots.length > 0 && classesData.length > 0 ? (
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse min-w-[600px]'>
            <thead>
              <tr>
                <th className='border border-gray-300 bg-gray-100 p-2 text-center font-medium text-xs sm:text-sm min-w-[80px]'>
                  Class
                </th>
                {timeSlots.map((slot) => (
                  <th
                    key={slot.key}
                    className='border border-gray-300 bg-gray-100 p-2 text-center font-medium text-xs sm:text-sm min-w-[120px]'
                  >
                    <div className='hidden sm:block'>{slot.formattedTime}</div>
                    <div className='sm:hidden text-xs'>{slot.formattedTime.replace(' - ', '-')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classesData.map((cls) => (
                <tr key={cls.id}>
                  <td className='border border-gray-300 bg-gray-50 p-2 sm:p-3 text-center font-medium text-xs sm:text-sm'>
                    <div className='hidden sm:block'>Class {cls.name}</div>
                    <div className='sm:hidden'>{cls.name}</div>
                  </td>
                  {timeSlots.map((slot) => {
                    const classInfo = classTimeTable[cls.id]?.[slot.key]

                    if (!classInfo) {
                      return (
                        <td
                          key={slot.key}
                          className='border border-gray-300 p-2 sm:p-4 text-center text-gray-400 text-xs sm:text-sm'
                        >
                          -
                        </td>
                      )
                    }

                    return (
                      <td
                        key={slot.key}
                        className='border border-gray-300 p-2 sm:p-4 text-center'
                      >
                        <div className='font-medium text-xs sm:text-sm'>{classInfo.subject}</div>
                        <div className='text-xs mt-1'>
                          <span className='hidden sm:inline'>({classInfo.teacher})</span>
                          <span className='sm:hidden'>({classInfo.teacher.split(' ')[0]})</span>
                        </div>
                        {classInfo.description && (
                          <div className='text-xs text-gray-600 mt-1 italic hidden sm:block'>
                            {classInfo.description}
                          </div>
                        )}
                        {canJoinClass && (
                          <div className='mt-2 sm:mt-3 flex flex-col sm:flex-row justify-center gap-2'>
                            {classInfo.zoomLink ? (
                              <>
                                <a
                                  href={classInfo.zoomLink}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='inline-flex items-center justify-center rounded-md bg-indigo-600 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white transition-colors hover:bg-indigo-700'
                                >
                                  <VideoIcon className='h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1' />
                                  <span>Zoom</span>
                                </a>
                                <a
                                  href={classInfo.joinUrl}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium text-red-600 transition-colors hover:bg-red-50'
                                >
                                  <Youtube className='h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1' />
                                  <span>YouTube</span>
                                </a>
                              </>
                            ) : (
                              <a
                                href={classInfo.joinUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center justify-center rounded-md bg-primary px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                              >
                                <VideoIcon className='h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5' />
                                <span className='hidden sm:inline'>Join Class</span>
                                <span className='sm:hidden'>Join</span>
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className='p-8 text-center text-muted-foreground border rounded-lg'>
          {isTeacher
            ? `You have no classes scheduled for ${format(
                new Date(selectedDate),
                'dd/MM/yyyy'
              )}.`
            : `No classes scheduled for ${format(
                new Date(selectedDate),
                'dd/MM/yyyy'
              )}.`}
        </div>
      )}
    </div>
  )
}
