import { useState, useEffect } from 'react'
import { getUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { redirect } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { format, addDays, parseISO } from 'date-fns'
import {
  calculateLiveClassStatus,
  normalizeLiveClassRecords,
} from '@/lib/liveClassDateTime'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CalendarIcon, BarChart3, MessageSquare, Users, BookOpen, Clock, CheckCircle2, XCircle, AlertCircle, Video, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

async function loadLearnerDashboard({
  activeStudentId,
  linkedStudentIds = [],
  includeStudentList = false,
}) {
  const learnerData = {
    studentInfo: null,
    attendance: [],
    timetable: [],
    homework: [],
    allStudents: [],
  }

  if (includeStudentList && linkedStudentIds.length > 0) {
    learnerData.allStudents = await query(
      `SELECT id, name FROM users WHERE id IN (?)`,
      [linkedStudentIds]
    )
  }

  if (!activeStudentId) {
    return learnerData
  }

  const studentInfoRows = await query(
    `SELECT u.name as student_name, c.name as class_name, sp.class_id, u.id as student_id
     FROM users u
     JOIN student_profiles sp ON u.id = sp.user_id
     JOIN classes c ON sp.class_id = c.id
     WHERE u.id = ?`,
    [activeStudentId]
  )

  learnerData.studentInfo = studentInfoRows[0] || null
  const classId = learnerData.studentInfo?.class_id

  learnerData.attendance = await query(
    `SELECT date, status FROM student_attendance
     WHERE student_id = ? ORDER BY date DESC LIMIT 14`,
    [activeStudentId]
  )

  if (!classId) {
    return learnerData
  }

  learnerData.timetable = await query(
    `SELECT z.id, IFNULL(s.name, z.topic_name) as subject_name,
            u.name as teacher_name,
            DATE(z.start_time) as class_date,
            DAYNAME(z.start_time) as day_of_week,
            TIME_FORMAT(z.start_time, '%H:%i') as start_time,
            TIME_FORMAT(z.end_time, '%H:%i') as end_time,
            z.zoom_link, z.youtube_live_link, z.session_type
     FROM live_classes z
     LEFT JOIN subjects s ON z.subject_id = s.id
     JOIN users u ON z.teacher_id = u.id
     WHERE z.class_id = ? AND z.start_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       AND z.start_time <= DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY z.start_time ASC LIMIT 10`,
    [classId]
  )

  learnerData.homework = await query(
    `SELECT h.title, h.description, s.name as subject_name,
            u.name as teacher_name, h.created_at
     FROM homework h
     JOIN subjects s ON h.subject_id = s.id
     JOIN users u ON h.teacher_id = u.id
     WHERE COALESCE(h.class_id, s.class_id) = ?
     ORDER BY h.created_at DESC LIMIT 5`,
    [classId]
  )

  return learnerData
}

async function loadTeacherDashboard(teacherId) {
  const teacherData = {
    liveClassSummary: [],
    teacherHomework: [],
    teacherTimetable: [],
  }

  const parseTeacherDashboardDate = (rawDate) => {
    if (!rawDate) return null
    if (rawDate instanceof Date) {
      return Number.isNaN(rawDate.getTime()) ? null : rawDate
    }

    const parsedDate = new Date(rawDate)
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
  }

  const resolveTeacherLiveClassStatus = (liveClass) => {
    const normalizedStatus = String(liveClass?.status || '').toLowerCase()

    if (normalizedStatus === 'cancelled') return 'cancelled'
    if (normalizedStatus === 'completed') return 'completed'

    return calculateLiveClassStatus(liveClass?.start_time, liveClass?.end_time) ===
      'completed'
      ? 'completed'
      : 'scheduled'
  }

  teacherData.teacherHomework = await query(
    `SELECT h.id,
            h.title,
            h.description,
            h.created_at,
            s.name as subject_name,
            COALESCE(ch.name, cs.name, 'Unassigned Class') as class_name
     FROM homework h
     JOIN subjects s ON h.subject_id = s.id
     LEFT JOIN classes cs ON s.class_id = cs.id
     LEFT JOIN classes ch ON h.class_id = ch.id
     WHERE h.teacher_id = ?
     ORDER BY h.created_at DESC`,
    [teacherId]
  )

  const teacherLiveClasses = normalizeLiveClassRecords(
    await query(
    `SELECT lc.id,
            lc.title,
            lc.topic_name,
            IFNULL(s.name, lc.topic_name) as subject_name,
            COALESCE(c.name, 'Unassigned Class') as class_name,
            lc.start_time,
            lc.end_time,
            lc.status,
            lc.youtube_live_link,
            lc.zoom_link
     FROM live_classes lc
     LEFT JOIN subjects s ON lc.subject_id = s.id
     LEFT JOIN classes c ON lc.class_id = c.id
     WHERE lc.teacher_id = ?
       AND lc.start_time IS NOT NULL
     ORDER BY lc.start_time DESC`,
    [teacherId]
  )
  )

  teacherData.teacherTimetable = teacherLiveClasses
    .map((liveClass) => ({
      ...liveClass,
      dashboard_status: resolveTeacherLiveClassStatus(liveClass),
    }))
    .filter((liveClass) => liveClass.dashboard_status !== 'cancelled')

  teacherData.liveClassSummary = Object.values(
    teacherData.teacherTimetable.reduce((acc, liveClass) => {
      const startTime = parseTeacherDashboardDate(liveClass.start_time)
      if (!startTime) return acc

      const sessionDate = format(startTime, 'yyyy-MM-dd')
      const existing = acc[sessionDate] || {
        session_date: sessionDate,
        scheduled_count: 0,
        completed_count: 0,
      }

      if (liveClass.dashboard_status === 'completed') {
        existing.completed_count += 1
      } else {
        existing.scheduled_count += 1
      }

      acc[sessionDate] = existing
      return acc
    }, {})
  ).sort((a, b) => {
    const left = parseTeacherDashboardDate(a.session_date)?.getTime() || 0
    const right = parseTeacherDashboardDate(b.session_date)?.getTime() || 0
    return right - left
  })

  return teacherData
}

async function loadSchoolAdminDashboard(user) {
  let schoolId = user.school_id

  if (!schoolId) {
    const schoolRows = await query(
      `SELECT id FROM schools WHERE users_id = ? LIMIT 1`,
      [user.id]
    )
    schoolId = schoolRows[0]?.id || null
  }

  if (!schoolId) {
    return {
      schools: [],
      classes: [],
      attendanceBySchool: [],
      liveClassSummary: [],
      schoolHomework: [],
      feedbackData: [],
    }
  }

  const schools = await query(
    `SELECT s.id, s.name, COUNT(DISTINCT sp.class_id) as class_count
     FROM schools s
     LEFT JOIN student_profiles sp ON sp.schools_id = s.id
     WHERE s.id = ?
     GROUP BY s.id, s.name`,
    [schoolId]
  )

  const classes = await query(
    `SELECT DISTINCT c.id, c.name, s.id as school_id, s.name as school_name
     FROM classes c
     JOIN student_profiles sp ON sp.class_id = c.id
     JOIN schools s ON sp.schools_id = s.id
     WHERE s.id = ?
     ORDER BY c.name`,
    [schoolId]
  )

  const attendanceBySchool = await query(
    `SELECT 
       sa.date,
       s.id as school_id,
       s.name as school_name,
       c.id as class_id,
       c.name as class_name,
       COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
       COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
       COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count
     FROM student_attendance sa
     JOIN student_profiles sp ON sa.student_id = sp.user_id
     JOIN schools s ON sp.schools_id = s.id
     JOIN classes c ON sa.class_id = c.id
     WHERE sp.schools_id = ?
     GROUP BY sa.date, s.id, s.name, c.id, c.name
     ORDER BY sa.date DESC, c.name ASC`,
    [schoolId]
  )

  const liveClassSummary = await query(
    `SELECT
       DATE(lc.start_time) as session_date,
       COALESCE(sch.id, ?) as school_id,
       COALESCE(sch.name, school.name) as school_name,
       c.id as class_id,
       c.name as class_name,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled' AND lc.start_time > NOW()
           THEN 1
           ELSE 0
         END
       ) as scheduled_count,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled'
             AND COALESCE(lc.end_time, lc.start_time) < NOW()
           THEN 1
           ELSE 0
         END
       ) as completed_count
     FROM live_classes lc
     JOIN classes c ON lc.class_id = c.id
     LEFT JOIN schools sch ON lc.school_id = sch.id
     JOIN schools school ON school.id = ?
     WHERE lc.start_time IS NOT NULL
       AND (lc.school_id = ? OR lc.is_all_schools = 1)
       AND (
         lc.start_time > NOW()
         OR COALESCE(lc.end_time, lc.start_time) < NOW()
       )
     GROUP BY DATE(lc.start_time), COALESCE(sch.id, ?), COALESCE(sch.name, school.name), c.id, c.name
     ORDER BY session_date DESC, class_name ASC`,
    [schoolId, schoolId, schoolId, schoolId]
  )

  const schoolHomework = await query(
    `SELECT h.id,
            h.title,
            h.description,
            h.created_at,
            s.id as subject_id,
            COALESCE(s.name, 'General') as subject_name,
            COALESCE(h.class_id, s.class_id) as class_id,
            COALESCE(ch.name, cs.name, 'Unassigned Class') as class_name,
            u.name as teacher_name
     FROM homework h
     LEFT JOIN subjects s ON h.subject_id = s.id
     LEFT JOIN classes cs ON s.class_id = cs.id
     LEFT JOIN classes ch ON h.class_id = ch.id
     JOIN users u ON h.teacher_id = u.id
     WHERE EXISTS (
       SELECT 1
       FROM student_profiles sp
       WHERE sp.schools_id = ?
         AND sp.class_id = COALESCE(h.class_id, s.class_id)
     )
     ORDER BY h.created_at DESC
     LIMIT 10`,
    [schoolId]
  )

  return {
    schools,
    classes,
    attendanceBySchool,
    liveClassSummary,
    schoolHomework,
    feedbackData: [],
  }
}

async function loadClassAdminDashboard(user) {
  let schoolId = user.school_id || null
  let allowedClassIds = (user.class_ids || []).map(Number).filter(Boolean)

  if (!schoolId || allowedClassIds.length === 0) {
    const classAdminAssignments = await query(
      `SELECT school_id, class_id
       FROM class_admins
       WHERE admin_id = ?
       ORDER BY class_id ASC`,
      [user.id]
    )

    if (classAdminAssignments.length > 0) {
      schoolId = schoolId || classAdminAssignments[0].school_id || null
      allowedClassIds = classAdminAssignments
        .map((item) => Number(item.class_id))
        .filter(Boolean)
    }
  }

  if (!schoolId || allowedClassIds.length === 0) {
    return {
      schools: [],
      classes: [],
      attendanceBySchool: [],
      liveClassSummary: [],
      schoolHomework: [],
      feedbackData: [],
    }
  }

  const classPlaceholders = allowedClassIds.map(() => '?').join(',')

  const schools = await query(
    `SELECT s.id, s.name, COUNT(DISTINCT sp.class_id) as class_count
     FROM schools s
     LEFT JOIN student_profiles sp ON sp.schools_id = s.id
     WHERE s.id = ?
     GROUP BY s.id, s.name`,
    [schoolId]
  )

  const classes = await query(
    `SELECT id, name, ? as school_id, ? as school_name
     FROM classes
     WHERE id IN (${classPlaceholders})
     ORDER BY name`,
    [
      schoolId,
      schools[0]?.name || 'Assigned School',
      ...allowedClassIds,
    ]
  )

  const attendanceBySchool = await query(
    `SELECT 
       sa.date,
       s.id as school_id,
       s.name as school_name,
       c.id as class_id,
       c.name as class_name,
       COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
       COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
       COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count
     FROM student_attendance sa
     JOIN student_profiles sp ON sa.student_id = sp.user_id
     JOIN schools s ON sp.schools_id = s.id
     JOIN classes c ON sa.class_id = c.id
     WHERE sp.schools_id = ?
       AND sa.class_id IN (${classPlaceholders})
     GROUP BY sa.date, s.id, s.name, c.id, c.name
     ORDER BY sa.date DESC, c.name ASC`,
    [schoolId, ...allowedClassIds]
  )

  const liveClassSummary = await query(
    `SELECT
       DATE(lc.start_time) as session_date,
       COALESCE(sch.id, ?) as school_id,
       COALESCE(sch.name, school.name) as school_name,
       c.id as class_id,
       c.name as class_name,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled' AND lc.start_time > NOW()
           THEN 1
           ELSE 0
         END
       ) as scheduled_count,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled'
             AND COALESCE(lc.end_time, lc.start_time) < NOW()
           THEN 1
           ELSE 0
         END
       ) as completed_count
     FROM live_classes lc
     JOIN classes c ON lc.class_id = c.id
     LEFT JOIN schools sch ON lc.school_id = sch.id
     JOIN schools school ON school.id = ?
     WHERE lc.start_time IS NOT NULL
       AND (lc.school_id = ? OR lc.is_all_schools = 1)
       AND lc.class_id IN (${classPlaceholders})
       AND (
         lc.start_time > NOW()
         OR COALESCE(lc.end_time, lc.start_time) < NOW()
       )
     GROUP BY DATE(lc.start_time), COALESCE(sch.id, ?), COALESCE(sch.name, school.name), c.id, c.name
     ORDER BY session_date DESC, class_name ASC`,
    [schoolId, schoolId, schoolId, ...allowedClassIds, schoolId]
  )

  const schoolHomework = await query(
    `SELECT h.id,
            h.title,
            h.description,
            h.created_at,
            s.id as subject_id,
            COALESCE(s.name, 'General') as subject_name,
            COALESCE(h.class_id, s.class_id) as class_id,
            COALESCE(ch.name, cs.name, 'Unassigned Class') as class_name,
            u.name as teacher_name
     FROM homework h
     LEFT JOIN subjects s ON h.subject_id = s.id
     LEFT JOIN classes cs ON s.class_id = cs.id
     LEFT JOIN classes ch ON h.class_id = ch.id
     JOIN users u ON h.teacher_id = u.id
     WHERE EXISTS (
       SELECT 1
       FROM student_profiles sp
       WHERE sp.schools_id = ?
         AND sp.class_id = COALESCE(h.class_id, s.class_id)
     )
       AND COALESCE(h.class_id, s.class_id) IN (${classPlaceholders})
     ORDER BY h.created_at DESC
     LIMIT 10`,
    [schoolId, ...allowedClassIds]
  )

  return {
    schools,
    classes,
    attendanceBySchool,
    liveClassSummary,
    schoolHomework,
    feedbackData: [],
  }
}

export async function loader({ request }) {
  const user = await getUser(request)
  const role = user.role_name

  // For non-super_admin users, redirect to their respective pages
  if (role !== 'super_admin') {
    if (role === 'school_admin') {
      const schoolAdminData = await loadSchoolAdminDashboard(user)
      return { user, role, ...schoolAdminData }
    } else if (role === 'class_admin') {
      const classAdminData = await loadClassAdminDashboard(user)
      return { user, role, ...classAdminData }
    } else if (role === 'teacher') {
      const teacherData = await loadTeacherDashboard(user.id)
      return { user, role, ...teacherData }
    } else if (role === 'student' || role === 'parent') {
      // Serve parent-specific dashboard — resolve linked student data
      const studentIds = user.student_ids || []
      const url = new URL(request.url)
      const selectedStudentId =
        role === 'parent'
          ? Number(url.searchParams.get('student_id') || studentIds[0] || 0) ||
            null
          : user.id
      
      const learnerData = await loadLearnerDashboard({
        activeStudentId: selectedStudentId,
        linkedStudentIds: studentIds,
        includeStudentList: role === 'parent',
      })

      return { user, role, ...learnerData, selectedStudentId }
    }
  }

  // For super_admin, fetch all schools
  const schools = await query(
    `SELECT s.id, s.name, COUNT(DISTINCT c.id) as class_count
     FROM schools s
     LEFT JOIN student_profiles sp ON s.id = sp.schools_id
     LEFT JOIN classes c ON sp.class_id = c.id
     GROUP BY s.id, s.name
     ORDER BY s.name`
  )

  // Get all classes
  const classes = await query(
    `SELECT c.id, c.name, s.id as school_id, s.name as school_name
     FROM classes c
     JOIN student_profiles sp ON c.id = sp.class_id
     JOIN schools s ON sp.schools_id = s.id
     GROUP BY c.id, c.name, s.id, s.name
     ORDER BY s.name, c.name`
  )

  // Get school/class/date attendance aggregates for the past 30 days
  const attendanceBySchool = await query(
    `SELECT 
       sa.date, 
       s.id as school_id,
       s.name as school_name,
       c.id as class_id,
       c.name as class_name,
       COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_count,
       COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_count,
       COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_count
     FROM student_attendance sa
     JOIN student_profiles sp ON sa.student_id = sp.user_id
     JOIN schools s ON sp.schools_id = s.id
     JOIN classes c ON sa.class_id = c.id
     GROUP BY sa.date, s.id, s.name, c.id, c.name
     ORDER BY sa.date DESC, s.name, c.name`
  )

  const liveClassSummary = await query(
    `SELECT
       DATE(lc.start_time) as session_date,
       COALESCE(sch.id, 0) as school_id,
       COALESCE(sch.name, 'All Schools') as school_name,
       c.id as class_id,
       c.name as class_name,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled' AND lc.start_time > NOW()
           THEN 1
           ELSE 0
         END
       ) as scheduled_count,
       SUM(
         CASE
           WHEN COALESCE(lc.status, '') <> 'cancelled'
             AND COALESCE(lc.end_time, lc.start_time) < NOW()
           THEN 1
           ELSE 0
         END
       ) as completed_count
     FROM live_classes lc
     JOIN classes c ON lc.class_id = c.id
     LEFT JOIN schools sch ON lc.school_id = sch.id
     WHERE lc.start_time IS NOT NULL
       AND (
         lc.start_time > NOW()
         OR COALESCE(lc.end_time, lc.start_time) < NOW()
       )
     GROUP BY DATE(lc.start_time), COALESCE(sch.id, 0), COALESCE(sch.name, 'All Schools'), c.id, c.name
     ORDER BY session_date DESC, school_name ASC, class_name ASC`
  )

  // Get feedback data aggregated by school and class
  const feedbackData = await query(
    `SELECT 
       s.id as school_id,
       s.name as school_name,
       c.id as class_id,
       c.name as class_name,
       pfi.section,
       AVG(pfi.rating) as avg_rating,
       COUNT(DISTINCT pf.id) as feedback_count
     FROM parent_feedback pf
     JOIN parent_feedback_items pfi ON pf.id = pfi.feedback_id
     JOIN users u ON pf.student_id = u.id
     JOIN student_profiles sp ON u.id = sp.user_id
     JOIN schools s ON sp.schools_id = s.id
     JOIN classes c ON sp.class_id = c.id
     GROUP BY s.id, s.name, c.id, c.name, pfi.section
     ORDER BY s.name, c.name, pfi.section`
  )

  return {
    user,
    schools,
    classes,
    attendanceBySchool,
    liveClassSummary,
    feedbackData,
  }
}

export default function Dashboard() {
  const {
    user,
    role,
    // parent-specific
    studentInfo,
    attendance = [],
    timetable = [],
    homework = [],
    allStudents = [],
    selectedStudentId,
    teacherHomework = [],
    teacherTimetable = [],
    schoolHomework = [],
    // super_admin
    schools = [],
    classes = [],
    attendanceBySchool = [],
    liveClassSummary = [],
    feedbackData = [],
  } = useLoaderData()

  // ── Parent Dashboard ─────────────────────────────────────────────────────
  if (role === 'parent' || role === 'student') {
    return <LearnerDashboard
      viewerRole={role}
      user={user}
      studentInfo={studentInfo}
      attendance={attendance}
      timetable={timetable}
      homework={homework}
      allStudents={allStudents}
      selectedStudentId={selectedStudentId}
    />
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (role === 'teacher') {
    return <TeacherDashboard
      user={user}
      liveClassSummary={liveClassSummary}
      homework={teacherHomework}
      timetable={teacherTimetable}
    />
  }

  const isSchoolAdmin = role === 'school_admin'
  const isScopedAdmin = role === 'school_admin' || role === 'class_admin'
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [selectedClass, setSelectedClass] = useState('all')
  const [dateRange, setDateRange] = useState(undefined)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calculate average rating for a specific section
  const calculateAverageRating = (section) => {
    if (!feedbackData || !Array.isArray(feedbackData) || feedbackData.length === 0) return 0

    // Filter by selected school and class, and by section
    const relevantFeedback = feedbackData.filter((item) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        item.school_id?.toString() === selectedSchool
      const isMatchingClass =
        selectedClass === 'all' || item.class_id?.toString() === selectedClass
      const isMatchingSection = item.section === section

      return isMatchingSchool && isMatchingClass && isMatchingSection
    })

    if (relevantFeedback.length === 0) return 0

    // Calculate average
    const sum = relevantFeedback.reduce((acc, item) => {
      return acc + parseFloat(item.avg_rating || 0)
    }, 0)

    return sum / relevantFeedback.length
  }

  // Get count of feedback for a specific section
  const getFeedbackCount = (section) => {
    if (!feedbackData || !Array.isArray(feedbackData) || feedbackData.length === 0) return 0

    // Filter by selected school and class, and by section
    const relevantFeedback = feedbackData.filter((item) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        item.school_id?.toString() === selectedSchool
      const isMatchingClass =
        selectedClass === 'all' || item.class_id?.toString() === selectedClass
      const isMatchingSection = item.section === section

      return isMatchingSchool && isMatchingClass && isMatchingSection
    })

    if (relevantFeedback.length === 0) return 0

    // Sum up all feedback counts
    return relevantFeedback.reduce((acc, item) => {
      return acc + parseInt(item.feedback_count || 0)
    }, 0)
  }

  // Function to prepare data for the feedback chart
  const prepareFeedbackChartData = () => {
    if (!feedbackData || !Array.isArray(feedbackData) || feedbackData.length === 0) return []

    // Filter based on selected school and class
    const filteredFeedback = feedbackData.filter((item) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        item.school_id?.toString() === selectedSchool
      const isMatchingClass =
        selectedClass === 'all' || item.class_id?.toString() === selectedClass

      return isMatchingSchool && isMatchingClass
    })

    // Group by school and class
    const groupedData = {}

    filteredFeedback.forEach((item) => {
      const key = `${item.school_name} - ${item.class_name}`

      if (!groupedData[key]) {
        groupedData[key] = {
          name: key,
          school_id: item.school_id,
          class_id: item.class_id,
          academic: 0,
          behavioral: 0,
          satisfaction: 0,
          academic_count: 0,
          behavioral_count: 0,
          satisfaction_count: 0,
          feedback_count: item.feedback_count,
        }
      }

      // Add to the appropriate section
      if (item.section === 'academic') {
        groupedData[key].academic += parseFloat(item.avg_rating) || 0
        groupedData[key].academic_count += 1
      } else if (item.section === 'behavioral') {
        groupedData[key].behavioral += parseFloat(item.avg_rating) || 0
        groupedData[key].behavioral_count += 1
      } else if (item.section === 'satisfaction') {
        groupedData[key].satisfaction += parseFloat(item.avg_rating) || 0
        groupedData[key].satisfaction_count += 1
      }
    })

    // Calculate averages and convert to array
    return Object.values(groupedData).map((group) => {
      return {
        name: group.name,
        school_id: group.school_id,
        class_id: group.class_id,
        academic:
          group.academic_count > 0 ? group.academic / group.academic_count : 0,
        behavioral:
          group.behavioral_count > 0
            ? group.behavioral / group.behavioral_count
            : 0,
        satisfaction:
          group.satisfaction_count > 0
            ? group.satisfaction / group.satisfaction_count
            : 0,
        feedback_count: group.feedback_count,
      }
    })
  }

  // Filter classes based on selected school
  const filteredClasses =
    selectedSchool === 'all'
      ? classes
      : classes.filter((cls) => cls.school_id?.toString() === selectedSchool)

  const parseDashboardDate = (rawDate) => {
    if (!rawDate) return null

    if (rawDate instanceof Date) {
      return Number.isNaN(rawDate.getTime()) ? null : new Date(rawDate)
    }

    if (typeof rawDate === 'string') {
      const isoDate = parseISO(rawDate)
      if (!Number.isNaN(isoDate.getTime())) return isoDate
    }

    const fallbackDate = new Date(rawDate)
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate
  }

  const normalizeDashboardDate = (rawDate) => {
    const parsedDate = parseDashboardDate(rawDate)
    return parsedDate ? format(parsedDate, 'yyyy-MM-dd') : String(rawDate ?? '')
  }

  const isWithinDateRange = (rawDate) => {
    const recordDate = parseDashboardDate(rawDate)
    const fromDate = dateRange?.from ? new Date(dateRange.from) : null
    const toDate = dateRange?.to ? new Date(dateRange.to) : null

    if (fromDate) fromDate.setHours(0, 0, 0, 0)
    if (toDate) toDate.setHours(23, 59, 59, 999)

    if (!recordDate) return false
    if (fromDate && recordDate < fromDate) return false
    if (toDate && recordDate > toDate) return false
    return true
  }

  const liveClassOverviewRows = liveClassSummary
    .filter((record) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        record.school_id?.toString() === selectedSchool
      const isMatchingClass =
        selectedClass === 'all' ||
        record.class_id?.toString() === selectedClass

      return (
        isMatchingSchool &&
        isMatchingClass &&
        isWithinDateRange(record.session_date)
      )
    })
    .reduce((acc, record) => {
      const key = normalizeDashboardDate(record.session_date)
      const existing = acc[key] || {
        session_date: key,
        scheduled_count: 0,
        completed_count: 0,
      }

      existing.scheduled_count += Number(record.scheduled_count || 0)
      existing.completed_count += Number(record.completed_count || 0)
      acc[key] = existing

      return acc
    }, {})

  const liveClassOverviewData = Object.values(liveClassOverviewRows).sort(
    (a, b) => parseDashboardDate(b.session_date) - parseDashboardDate(a.session_date)
  )

  const schoolAttendanceRows = attendanceBySchool
    .filter((record) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        record.school_id?.toString() === selectedSchool
      const isMatchingClass =
        selectedClass === 'all' ||
        record.class_id?.toString() === selectedClass

      return isMatchingSchool && isMatchingClass && isWithinDateRange(record.date)
    })
    .reduce((acc, record) => {
      const key = record.school_id
      const existing = acc[key] || {
        school_id: record.school_id,
        school_name: record.school_name,
        present_count: 0,
        absent_count: 0,
      }

      existing.present_count += Number(record.present_count || 0)
      existing.absent_count += Number(record.absent_count || 0)
      acc[key] = existing

      return acc
    }, {})

  const schoolAttendanceSummary = Object.values(schoolAttendanceRows).sort((a, b) =>
    a.school_name.localeCompare(b.school_name)
  )

  const filteredSchoolHomework = [...schoolHomework]
    .filter((item) => {
      const isMatchingSchool =
        selectedSchool === 'all' ||
        schools.some((school) => school.id?.toString() === selectedSchool)
      const isMatchingClass =
        selectedClass === 'all' || item.class_id?.toString() === selectedClass

      return isMatchingSchool && isMatchingClass && isWithinDateRange(item.created_at)
    })
    .sort((a, b) => parseDashboardDate(b.created_at) - parseDashboardDate(a.created_at))
    .slice(0, 10)

  // Handle date range selection
  const onDateRangeChange = (range) => {
    if (range?.from) {
      // If only "from" is selected, limit range to 30 days
      if (!range.to) {
        const thirtyDaysLater = addDays(range.from, 30)
        const maxSelectableDate = addDays(new Date(), 30)
        const limitedTo =
          thirtyDaysLater > maxSelectableDate
            ? maxSelectableDate
            : thirtyDaysLater
        setDateRange({ ...range, to: limitedTo })
      } else {
        setDateRange(range)
      }
    } else {
      setDateRange(range)
    }
  }

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col gap-4 mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <h1 className='text-xl font-semibold'>Dashboard</h1>
          <div className='text-sm text-muted-foreground'>
            {selectedSchool !== 'all' && filteredClasses.length > 0 && (
              <span>Showing data for selected filters</span>
            )}
          </div>
        </div>
        
        <Card className='p-4'>
          <div className='flex flex-col gap-3'>
            <div className='text-sm font-medium text-muted-foreground'>Filters</div>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <Select
                value={selectedSchool}
                onValueChange={(value) => {
                  setSelectedSchool(value)
                  if (value !== selectedSchool) {
                    setSelectedClass('all')
                  }
                }}
                defaultValue='all'
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a school' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Schools</SelectItem>
                  {Array.isArray(schools) &&
                    schools.map((school) => (
                      <SelectItem
                        key={school.id}
                        value={school.id ? school.id.toString() : ''}
                      >
                        {school.name} ({school.class_count || 0})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedClass}
                onValueChange={setSelectedClass}
                defaultValue='all'
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a class' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Classes</SelectItem>
                  {Array.isArray(filteredClasses) &&
                    filteredClasses.map((cls) => (
                      <SelectItem
                        key={cls.id}
                        value={cls.id ? cls.id.toString() : ''}
                      >
                        Class {cls.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id='date'
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <CalendarIcon className='mr-2 h-4 w-4 flex-shrink-0' />
                    <span className='truncate text-xs sm:text-sm'>
                      {dateRange?.from ? (
                        dateRange?.to ? (
                          <>
                            {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                          </>
                        ) : (
                          format(dateRange.from, 'MMM dd')
                        )
                      ) : (
                        'All Dates'
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='end'>
                  <Calendar
                    initialFocus
                    mode='range'
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={onDateRangeChange}
                    numberOfMonths={isMobile ? 1 : 2}
                    disabled={(date) => date > addDays(new Date(), 30)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue='overview' className='w-full'>
        <TabsList className='grid w-full grid-cols-3 mb-6'>
          <TabsTrigger value='overview' className='flex items-center gap-2 text-xs sm:text-sm'>
            <BarChart3 className='h-4 w-4' />
            <span className='hidden sm:inline'>Overview</span>
            <span className='sm:hidden'>Stats</span>
          </TabsTrigger>
          <TabsTrigger value='feedback' className='flex items-center gap-2 text-xs sm:text-sm'>
            {isScopedAdmin ? <BookOpen className='h-4 w-4' /> : <MessageSquare className='h-4 w-4' />}
            <span className='hidden sm:inline'>{isScopedAdmin ? 'Homework' : 'Feedback'}</span>
            <span className='sm:hidden'>{isScopedAdmin ? 'Work' : 'Reviews'}</span>
          </TabsTrigger>
          <TabsTrigger value='attendance' className='flex items-center gap-2 text-xs sm:text-sm'>
            <Users className='h-4 w-4' />
            <span className='hidden sm:inline'>Attendance</span>
            <span className='sm:hidden'>Present</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Scheduled Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {liveClassOverviewData.reduce(
                    (sum, item) => sum + Number(item.scheduled_count || 0),
                    0
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Future scheduled sessions in the selected range
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Completed Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {liveClassOverviewData.reduce(
                    (sum, item) => sum + Number(item.completed_count || 0),
                    0
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Previously completed sessions in the selected range
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Dates Tracked
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{liveClassOverviewData.length}</div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Datewise live class summary in descending order
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>
                Live Classes By Date
              </CardTitle>
              <CardDescription>
                Future scheduled vs previous completed live classes, newest dates first
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {liveClassOverviewData.length > 0 ? (
                liveClassOverviewData.map((item) => (
                  <div
                    key={item.session_date}
                    className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'
                  >
                    <div>
                      <div className='font-semibold'>
                        {parseDashboardDate(item.session_date)
                          ? format(
                              parseDashboardDate(item.session_date),
                              'EEEE, MMM dd, yyyy'
                            )
                          : String(item.session_date ?? 'Unknown date')}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        Total sessions:{' '}
                        {Number(item.scheduled_count || 0) +
                          Number(item.completed_count || 0)}
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Badge className='bg-blue-100 text-blue-700 hover:bg-blue-100'>
                        Scheduled: {item.scheduled_count}
                      </Badge>
                      <Badge className='bg-emerald-100 text-emerald-700 hover:bg-emerald-100'>
                        Completed: {item.completed_count}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-center text-muted-foreground py-4'>
                  No live class summary available for the selected filters.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='feedback' className='space-y-6'>
          {isScopedAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Homework</CardTitle>
                <CardDescription>
                  {role === 'class_admin'
                    ? 'Latest 10 homework items from your assigned classes in descending date order'
                    : 'Latest 10 homework items from your school in descending date order'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {filteredSchoolHomework.length > 0 ? (
                  filteredSchoolHomework.map((item) => {
                    const createdAt = parseDashboardDate(item.created_at)

                    return (
                      <div key={item.id} className='rounded-lg border p-4 space-y-3'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                          <div>
                            <div className='font-semibold'>{item.title}</div>
                            <div className='text-sm text-muted-foreground'>
                              {item.subject_name} • Class {item.class_name}
                            </div>
                            <div className='text-sm text-muted-foreground'>
                              Teacher: {item.teacher_name}
                            </div>
                          </div>
                          <Badge variant='outline'>
                            {createdAt
                              ? format(createdAt, 'EEEE, MMM dd, yyyy')
                              : String(item.created_at ?? 'Unknown date')}
                          </Badge>
                        </div>
                        {item.description ? (
                          <p className='text-sm text-muted-foreground'>{item.description}</p>
                        ) : (
                          <p className='text-sm text-muted-foreground'>No description provided.</p>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className='text-center text-muted-foreground py-4'>
                    No homework available for the selected filters.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className='grid grid-cols-1 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-lg'>Parent Feedback Summary</CardTitle>
                  <CardDescription>
                    Detailed breakdown of parent feedback across different categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                    <div className='text-center p-4 bg-blue-50 rounded-lg'>
                      <div className='text-2xl font-bold text-blue-600'>
                        {calculateAverageRating('academic').toFixed(1)}
                      </div>
                      <div className='text-sm text-blue-600 font-medium'>Academic</div>
                      <div className='text-xs text-muted-foreground'>
                        {getFeedbackCount('academic')} reviews
                      </div>
                    </div>
                    <div className='text-center p-4 bg-green-50 rounded-lg'>
                      <div className='text-2xl font-bold text-green-600'>
                        {calculateAverageRating('behavioral').toFixed(1)}
                      </div>
                      <div className='text-sm text-green-600 font-medium'>Behavioral</div>
                      <div className='text-xs text-muted-foreground'>
                        {getFeedbackCount('behavioral')} reviews
                      </div>
                    </div>
                    <div className='text-center p-4 bg-purple-50 rounded-lg'>
                      <div className='text-2xl font-bold text-purple-600'>
                        {calculateAverageRating('satisfaction').toFixed(1)}
                      </div>
                      <div className='text-sm text-purple-600 font-medium'>Satisfaction</div>
                      <div className='text-xs text-muted-foreground'>
                        {getFeedbackCount('satisfaction')} reviews
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value='attendance' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Schoolwise Attendance</CardTitle>
              <CardDescription>
                Present vs absent attendance counts across the selected range
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {schoolAttendanceSummary.length === 0 ? (
                <p className='text-center text-muted-foreground py-4'>
                  No attendance summary available for the selected filters.
                </p>
              ) : (
                schoolAttendanceSummary.map((item) => {
                  const presentCount = Number(item.present_count || 0)
                  const absentCount = Number(item.absent_count || 0)
                  const total = presentCount + absentCount
                  const presentRate =
                    total > 0 ? Math.round((presentCount / total) * 100) : 0

                  return (
                    <div
                      key={item.school_id}
                      className='rounded-lg border p-4 space-y-3'
                    >
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <div className='font-semibold'>{item.school_name}</div>
                          <div className='text-sm text-muted-foreground'>
                            Total marked attendance: {total}
                          </div>
                        </div>
                        <Badge variant='outline'>{presentRate}% present</Badge>
                      </div>
                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <div className='rounded-md bg-emerald-50 p-3'>
                          <div className='text-sm text-emerald-700'>Present</div>
                          <div className='text-2xl font-semibold text-emerald-800'>
                            {presentCount}
                          </div>
                        </div>
                        <div className='rounded-md bg-rose-50 p-3'>
                          <div className='text-sm text-rose-700'>Absent</div>
                          <div className='text-2xl font-semibold text-rose-800'>
                            {absentCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* <Card>
        <CardHeader>
          <CardTitle>Average Feedback Ratings by School and Class</CardTitle>
          <CardDescription>
            Shows the average ratings across different feedback categories
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-6'>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={prepareFeedbackChartData()}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  angle={-45}
                  textAnchor='end'
                  height={80}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  label={{
                    value: 'Average Rating (1-5)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  formatter={(value) => [value.toFixed(1), 'Average Rating']}
                />
                <Legend />
                <Bar dataKey='academic' name='Academic' fill='#8884d8' />
                <Bar dataKey='behavioral' name='Behavioral' fill='#82ca9d' />
                <Bar
                  dataKey='satisfaction'
                  name='Overall Satisfaction'
                  fill='#ffc658'
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {feedbackData.length === 0 && (
            <p className='text-center text-muted-foreground py-4'>
              No feedback data available. Parents need to submit feedback first.
            </p>
          )}
        </CardContent>
      </Card> */}
    </div>
  )
}

function TeacherDashboard({
  user,
  liveClassSummary = [],
  homework = [],
  timetable = [],
}) {
  const [dateRange, setDateRange] = useState(undefined)
  const [isMobile, setIsMobile] = useState(false)
  const isDateFiltered = Boolean(dateRange?.from || dateRange?.to)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const parseTeacherDate = (rawDate) => {
    if (!rawDate) return null

    if (rawDate instanceof Date) {
      return Number.isNaN(rawDate.getTime()) ? null : new Date(rawDate)
    }

    if (typeof rawDate === 'string') {
      const isoDate = parseISO(rawDate)
      if (!Number.isNaN(isoDate.getTime())) return isoDate
    }

    const fallbackDate = new Date(rawDate)
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate
  }

  const normalizeTeacherDate = (rawDate) => {
    const parsedDate = parseTeacherDate(rawDate)
    return parsedDate ? format(parsedDate, 'yyyy-MM-dd') : String(rawDate ?? '')
  }

  const isWithinDateRange = (rawDate) => {
    const recordDate = parseTeacherDate(rawDate)
    const fromDate = dateRange?.from ? new Date(dateRange.from) : null
    const toDate = dateRange?.to ? new Date(dateRange.to) : null

    if (fromDate) fromDate.setHours(0, 0, 0, 0)
    if (toDate) toDate.setHours(23, 59, 59, 999)

    if (!recordDate) return false
    if (fromDate && recordDate < fromDate) return false
    if (toDate && recordDate > toDate) return false
    return true
  }

  const teacherOverviewData = Object.values(
    liveClassSummary
      .filter((item) => isWithinDateRange(item.session_date))
      .reduce((acc, item) => {
        const key = normalizeTeacherDate(item.session_date)
        const existing = acc[key] || {
          session_date: key,
          scheduled_count: 0,
          completed_count: 0,
        }

        existing.scheduled_count += Number(item.scheduled_count || 0)
        existing.completed_count += Number(item.completed_count || 0)
        acc[key] = existing
        return acc
      }, {})
  ).sort(
    (a, b) => parseTeacherDate(b.session_date) - parseTeacherDate(a.session_date)
  )

  const filteredHomework = [...homework]
    .filter((item) => isWithinDateRange(item.created_at))
    .sort((a, b) => parseTeacherDate(b.created_at) - parseTeacherDate(a.created_at))

  const filteredTimetable = [...timetable]
    .filter((item) => isWithinDateRange(item.start_time))
    .sort((a, b) => parseTeacherDate(b.start_time) - parseTeacherDate(a.start_time))

  const onDateRangeChange = (range) => {
    if (range?.from && !range.to) {
      const thirtyDaysLater = addDays(range.from, 30)
      const maxSelectableDate = addDays(new Date(), 30)
      const limitedTo =
        thirtyDaysLater > maxSelectableDate ? maxSelectableDate : thirtyDaysLater
      setDateRange({ ...range, to: limitedTo })
      return
    }

    setDateRange(range)
  }

  return (
    <div className='container mx-auto px-4 pb-10'>
      <div className='flex flex-col gap-4 mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-xl font-semibold'>Teacher Dashboard</h1>
            <p className='text-sm text-muted-foreground'>
              {user?.name}'s class summary, homework, and timetable
            </p>
          </div>
        </div>

        <Card className='p-4'>
          <div className='flex flex-col gap-3'>
            <div className='text-sm font-medium text-muted-foreground'>Filters</div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id='teacher-date'
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <CalendarIcon className='mr-2 h-4 w-4 flex-shrink-0' />
                    <span className='truncate text-xs sm:text-sm'>
                      {dateRange?.from ? (
                        dateRange?.to ? (
                          <>
                            {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                          </>
                        ) : (
                          format(dateRange.from, 'MMM dd')
                        )
                      ) : (
                        'All Dates'
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='end'>
                  <Calendar
                    initialFocus
                    mode='range'
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={onDateRangeChange}
                    numberOfMonths={isMobile ? 1 : 2}
                    disabled={(date) => date > addDays(new Date(), 30)}
                  />
                </PopoverContent>
              </Popover>
              {isDateFiltered ? (
                <Button
                  variant='outline'
                  className='w-full'
                  onClick={() => setDateRange(undefined)}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue='overview' className='w-full'>
        <TabsList className='grid w-full grid-cols-3 mb-6'>
          <TabsTrigger value='overview' className='flex items-center gap-2 text-xs sm:text-sm'>
            <BarChart3 className='h-4 w-4' />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value='homework' className='flex items-center gap-2 text-xs sm:text-sm'>
            <BookOpen className='h-4 w-4' />
            <span>Homework</span>
          </TabsTrigger>
          <TabsTrigger value='timetable' className='flex items-center gap-2 text-xs sm:text-sm'>
            <Clock className='h-4 w-4' />
            <span>Timetable</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Scheduled Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {teacherOverviewData.reduce(
                    (sum, item) => sum + Number(item.scheduled_count || 0),
                    0
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Future scheduled sessions in descending order
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Completed Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {teacherOverviewData.reduce(
                    (sum, item) => sum + Number(item.completed_count || 0),
                    0
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Completed sessions in descending order
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Dates Tracked
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{teacherOverviewData.length}</div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Datewise class summary
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Live Classes By Date</CardTitle>
              <CardDescription>
                Scheduled and completed classes grouped by date in descending order
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {teacherOverviewData.length > 0 ? (
                teacherOverviewData.map((item) => (
                  <div
                    key={item.session_date}
                    className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'
                  >
                    <div>
                      <div className='font-semibold'>
                        {format(parseTeacherDate(item.session_date), 'EEEE, MMM dd, yyyy')}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        Total sessions:{' '}
                        {Number(item.scheduled_count || 0) +
                          Number(item.completed_count || 0)}
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Badge className='bg-emerald-100 text-emerald-700 hover:bg-emerald-100'>
                        Scheduled: {item.scheduled_count}
                      </Badge>
                      <Badge className='bg-rose-100 text-rose-700 hover:bg-rose-100'>
                        Completed: {item.completed_count}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-center text-muted-foreground py-4'>
                  {isDateFiltered
                    ? 'No class overview available for the selected range. Clear the date filter to view all records.'
                    : 'No class overview available.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='homework' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Assigned Homework</CardTitle>
              <CardDescription>
                Homework assigned by you, newest first
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {filteredHomework.length > 0 ? (
                filteredHomework.map((item) => (
                  <div key={item.id} className='rounded-lg border p-4 space-y-3'>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <div>
                        <div className='font-semibold'>{item.title}</div>
                        <div className='text-sm text-muted-foreground'>
                          {item.subject_name} • Class {item.class_name}
                        </div>
                      </div>
                      <Badge variant='outline'>
                        {format(parseTeacherDate(item.created_at), 'EEEE, MMM dd, yyyy')}
                      </Badge>
                    </div>
                    {item.description ? (
                      <p className='text-sm text-muted-foreground'>{item.description}</p>
                    ) : (
                      <p className='text-sm text-muted-foreground'>No description provided.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className='text-center text-muted-foreground py-4'>
                  {isDateFiltered
                    ? 'No homework found for the selected range. Clear the date filter to view all records.'
                    : 'No homework found.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='timetable' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Timetable</CardTitle>
              <CardDescription>
                Your live-class schedule in descending date order
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {filteredTimetable.length > 0 ? (
                filteredTimetable.map((item) => {
                  const status = item.dashboard_status === 'completed'
                    ? 'completed'
                    : 'scheduled'
                  const statusClasses = status === 'completed'
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'

                  return (
                    <div key={item.id} className='rounded-lg border p-4 space-y-3'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <div className='font-semibold'>
                            {item.topic_name || item.title || item.subject_name}
                          </div>
                          <div className='text-sm text-muted-foreground'>
                            {item.subject_name} • Class {item.class_name}
                          </div>
                        </div>
                        <Badge className={statusClasses}>
                          {status === 'completed' ? 'Completed' : 'Scheduled'}
                        </Badge>
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        {format(parseTeacherDate(item.start_time), 'EEEE, MMM dd, yyyy')} •{' '}
                        {format(parseTeacherDate(item.start_time), 'hh:mm a')}
                        {item.end_time ? ` - ${format(parseTeacherDate(item.end_time), 'hh:mm a')}` : ''}
                      </div>
                      {(item.zoom_link || item.youtube_live_link) && (
                        <Button
                          variant='outline'
                          className='w-full sm:w-auto'
                          onClick={() =>
                            window.open(item.zoom_link || item.youtube_live_link, '_blank')
                          }
                        >
                          Open Session <ExternalLink className='ml-2 h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className='text-center text-muted-foreground py-4'>
                  {isDateFiltered
                    ? 'No timetable entries found for the selected range. Clear the date filter to view all records.'
                    : 'No timetable entries found.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Parent Dashboard Component ──────────────────────────────────────────────
function LearnerDashboard({
  viewerRole,
  user,
  studentInfo,
  attendance,
  timetable,
  homework,
  allStudents,
  selectedStudentId,
}) {
  const getHour = () => new Date().getHours()
  const greeting = getHour() < 12 ? 'Good Morning' : getHour() < 17 ? 'Good Afternoon' : 'Good Evening'

  const presentCount = attendance.filter(a => a.status === 'present').length
  const absentCount = attendance.filter(a => a.status === 'absent').length
  const lateCount = attendance.filter(a => a.status === 'late').length
  const total = attendance.length
  const presentPct = total > 0 ? Math.round((presentCount / total) * 100) : 0

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayClasses = timetable.filter(t => {
    const d = t.class_date ? t.class_date.toString().split('T')[0] : ''
    return d === todayStr
  })
  const upcomingClasses = timetable.filter(t => {
    const d = t.class_date ? t.class_date.toString().split('T')[0] : ''
    return d !== todayStr
  })

  const statusColors = {
    present: 'bg-emerald-500',
    absent: 'bg-red-500',
    late: 'bg-amber-400'
  }

  const formatAttDate = (raw) => {
    try { return format(new Date(raw), 'MMM d') }
    catch { return String(raw) }
  }

  const handleStudentChange = (id) => {
    const url = new URL(window.location.href)
    url.searchParams.set('student_id', id)
    window.location.href = url.toString()
  }

  const selectedStudentValue = selectedStudentId?.toString()
  const dashboardTitle = studentInfo
    ? studentInfo.student_name
    : viewerRole === 'student'
      ? 'My Dashboard'
      : "Child's Dashboard"

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20'>
      <div className='container mx-auto px-4 py-8 max-w-5xl'>

        {/* ── Welcome Banner & Student Selector ── */}
        <div className='relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 text-white p-8 md:p-10 mb-8 shadow-2xl border border-white/10'>
          <div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8'>
            <div className='flex-1'>
              <div className='flex items-center gap-2 text-indigo-100/80 mb-3'>
                <span className='w-10 h-[2px] bg-white/30 rounded-full' />
                <p className='text-xs font-bold uppercase tracking-[0.2em]'>{greeting}, {user?.name?.split(' ')[0]}</p>
              </div>
              <h1 className='text-4xl md:text-5xl font-black tracking-tight mb-3'>
                {dashboardTitle}
              </h1>
              {studentInfo && (
                <div className='flex flex-wrap items-center gap-3 mt-6'>
                  <div className='flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10'>
                    <Users className='w-4 h-4 text-indigo-200' />
                    <span className='text-sm font-bold'>Class {studentInfo.class_name}</span>
                  </div>
                  <div className='flex items-center gap-2 bg-black/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5'>
                    <Badge variant='outline' className='border-none p-0 text-white/60 text-[10px] font-mono'>ID: {selectedStudentId}</Badge>
                  </div>
                </div>
              )}
            </div>

            {viewerRole === 'parent' && allStudents.length > 1 && (
              <div className='flex flex-col gap-3 shrink-0 self-start md:self-center'>
                <label className='text-[10px] font-black uppercase tracking-widest text-indigo-200/60 ml-2'>Switch Account</label>
                <div className='bg-white/10 backdrop-blur-xl rounded-[1.25rem] p-1.5 border border-white/10 w-full sm:w-72 shadow-inner'>
                  <Select value={selectedStudentValue} onValueChange={handleStudentChange}>
                    <SelectTrigger className='bg-transparent border-none text-white focus:ring-0 h-12'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-xl bg-gradient-to-tr from-white/20 to-white/5 flex items-center justify-center text-xs font-black border border-white/10'>
                          {studentInfo?.student_name?.charAt(0)}
                        </div>
                        <SelectValue placeholder='Select child' />
                      </div>
                    </SelectTrigger>
                    <SelectContent className='bg-indigo-950 border-indigo-800 text-white rounded-2xl'>
                      {allStudents.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()} className='focus:bg-indigo-800 focus:text-white cursor-pointer py-3 rounded-xl m-1'>
                          <div className='flex items-center gap-2'>
                            <span className='w-2 h-2 rounded-full bg-indigo-400' />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          
          {/* Decorative Elements */}
          <div className='absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-[100px]' />
          <div className='absolute -bottom-12 left-1/3 w-48 h-48 rounded-full bg-indigo-400/10 blur-[80px]' />
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
          {/* ── Sidebar Column ── */}
          <div className='lg:col-span-4 flex flex-col gap-8'>
            
            {/* Attendance Analytics */}
            <Card className='shadow-xl shadow-slate-200/50 border-none bg-white rounded-[2rem] overflow-hidden'>
              <CardHeader className='pb-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm'>
                      <CheckCircle2 className='h-5 w-5' />
                    </div>
                    <div>
                      <CardTitle className='text-sm font-black uppercase tracking-wider'>Attendance</CardTitle>
                      <CardDescription className='text-[10px] font-bold text-slate-400'>PAST 14 RECORDS</CardDescription>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className={`text-2xl font-black leading-none ${presentPct >= 75 ? 'text-emerald-600' : 'text-rose-500'}`}>{presentPct}%</div>
                    <span className='text-[9px] font-black uppercase text-slate-300 tracking-tighter'>Overall</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className='flex gap-2 mb-8 flex-wrap'>
                  <div className='flex items-center gap-2 text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/50 shadow-sm'>
                    {presentCount} PRESENT
                  </div>
                  <div className='flex items-center gap-2 text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100/50 shadow-sm'>
                    {absentCount} ABSENT
                  </div>
                </div>
                
                {attendance.length > 0 ? (
                  <div className='grid grid-cols-7 gap-3 px-1'>
                    {[...attendance].reverse().map((a, i) => (
                      <div key={i} className='flex flex-col items-center gap-2'>
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white text-[11px] font-black shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-indigo-100 cursor-default ${statusColors[a.status] || 'bg-slate-200'}`}>
                          {a.status === 'present' ? 'P' : a.status === 'absent' ? 'A' : 'L'}
                        </div>
                        <span className='text-[9px] font-bold text-slate-400 uppercase tracking-tighter'>{formatAttDate(a.date)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='py-8 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100'>
                    <p className='text-xs text-slate-400 font-bold italic'>No activity detected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Smart Homework List */}
            <Card className='shadow-xl shadow-slate-200/50 border-none bg-white rounded-[2rem] flex-1 min-h-[400px]'>
               <CardHeader className='pb-4 border-b border-slate-50'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm'>
                      <BookOpen className='h-5 w-5' />
                    </div>
                    <div>
                      <CardTitle className='text-sm font-black uppercase tracking-wider'>Assignments</CardTitle>
                      <CardDescription className='text-[10px] font-bold text-slate-400'>RECENT UPDATES</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='pt-6 space-y-4 px-4'>
                {homework.length > 0 ? (
                  homework.map((hw, i) => (
                    <div key={i} className='group p-5 rounded-[1.5rem] border border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all duration-300 cursor-pointer relative overflow-hidden'>
                      <div className='relative z-10'>
                        <div className='flex items-center justify-between gap-4 mb-2'>
                          <span className='text-[10px] font-black text-indigo-600 bg-indigo-100/50 px-2.5 py-1 rounded-lg tracking-widest uppercase'>
                            {hw.subject_name}
                          </span>
                          <span className='text-[9px] font-black text-slate-300 uppercase'>
                            {formatAttDate(hw.created_at)}
                          </span>
                        </div>
                        <h4 className='font-black text-sm text-slate-800 leading-tight group-hover:text-indigo-700 transition-colors uppercase tracking-tight'>{hw.title}</h4>
                        <div className='flex items-center gap-1.5 mt-2'>
                          <div className='w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500'>
                            {hw.teacher_name?.charAt(0)}
                          </div>
                          <span className='text-[10px] font-bold text-slate-400'>{hw.teacher_name}</span>
                        </div>
                        {hw.description && (
                          <p className='text-xs text-slate-500 mt-4 line-clamp-2 leading-relaxed font-medium opacity-80'>{hw.description}</p>
                        )}
                      </div>
                      <div className='absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors' />
                    </div>
                  ))
                ) : (
                  <div className='py-20 text-center opacity-40'>
                    <BookOpen className='w-12 h-12 mx-auto mb-4 text-slate-200' />
                    <p className='text-xs font-black uppercase text-slate-300'>All caught up</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Main Content Column ── */}
          <div className='lg:col-span-8 flex flex-col gap-8'>
            <Card className='shadow-2xl shadow-indigo-100/50 border-none bg-white rounded-[2.5rem] h-full overflow-hidden'>
              <CardHeader className='p-8 border-b border-slate-50 bg-slate-50/30'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-6'>
                  <div className='flex items-center gap-4'>
                    <div className='p-3.5 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-100'>
                      <Clock className='h-6 w-6' />
                    </div>
                    <div>
                      <CardTitle className='text-xl font-black tracking-tight text-slate-900'>Live Learning Portal</CardTitle>
                      <CardDescription className='text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest'>
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant='link' className='text-xs font-black text-indigo-600 uppercase tracking-widest p-0 h-auto hover:no-underline hover:text-indigo-700'>
                    View Full Calendar <ExternalLink className='w-3 h-3 ml-1.5' />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='p-8'>
                <div className='space-y-8'>
                  {todayClasses.length > 0 ? (
                    <div className='space-y-5'>
                      <div className='flex items-center gap-3 mb-6'>
                        <span className='w-2 h-2 rounded-full bg-rose-500 animate-ping' />
                        <h3 className='text-[11px] font-black uppercase tracking-[0.2em] text-rose-500'>Happening Today</h3>
                      </div>
                      {todayClasses.map((cls, i) => (
                        <div key={i} className='group flex flex-col md:flex-row items-center justify-between p-6 bg-white rounded-[2rem] border-2 border-slate-50 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300'>
                          <div className='flex flex-col md:flex-row items-center gap-6 w-full md:w-auto text-center md:text-left'>
                            <div className='w-16 h-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shrink-0 shadow-xl shadow-indigo-100 group-hover:rotate-3 transition-transform'>
                              <Video className='h-8 w-8 text-white' />
                            </div>
                            <div>
                               <div className='flex flex-wrap justify-center md:justify-start items-center gap-2 mb-2'>
                                <span className='text-[10px] font-black text-white bg-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter'>{cls.subject_name}</span>
                                <span className='text-[10px] font-black text-indigo-400 bg-indigo-50 px-3 py-1 rounded-full'>{cls.start_time} – {cls.end_time}</span>
                              </div>
                              <h4 className='text-lg font-black text-slate-900 tracking-tight'>{cls.topic_name || cls.subject_name}</h4>
                              <p className='text-sm font-bold text-slate-400 mt-1 flex items-center gap-1.5 justify-center md:justify-start'>
                                <Users className='w-3 h-3' /> Instructor: {cls.teacher_name}
                              </p>
                            </div>
                          </div>
                          {(cls.zoom_link || cls.youtube_live_link) && (
                            <a
                              href={cls.zoom_link || cls.youtube_live_link}
                              target='_blank'
                              rel='noreferrer'
                              className='w-full md:w-auto mt-6 md:mt-0 flex items-center justify-center gap-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 px-10 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-95 group-hover:px-12'
                            >
                              START CLASS <ExternalLink className='h-4 w-4' />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-24 bg-slate-50/50 rounded-[3rem] border-4 border-dotted border-slate-100'>
                      <div className='w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-50'>
                        <Clock className='w-10 h-10 text-slate-200' />
                      </div>
                      <h3 className='text-base font-black text-slate-400 uppercase tracking-widest'>No Classes Scheduled</h3>
                      <p className='text-xs text-slate-300 font-bold mt-2'>PLEASE CHECK BACK LATER FOR UPDATES</p>
                    </div>
                  )}

                  {upcomingClasses.length > 0 && (
                    <div className='pt-10 border-t border-slate-50'>
                      <div className='flex items-center justify-between mb-6'>
                        <h3 className='text-[11px] font-black uppercase tracking-[0.2em] text-slate-400'>Weekly Forecast</h3>
                        <span className='text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded'>{upcomingClasses.length} UPCOMING</span>
                      </div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        {upcomingClasses.slice(0, 4).map((cls, i) => (
                          <div key={i} className='flex items-center justify-between p-5 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-100 hover:bg-white transition-all duration-300'>
                            <div>
                              <div className='font-black text-sm text-slate-800 uppercase tracking-tight'>{cls.subject_name}</div>
                              <div className='text-[10px] font-bold text-slate-400 mt-1 uppercase'>{cls.teacher_name}</div>
                            </div>
                            <div className='text-right'>
                              <div className='text-[11px] font-black text-indigo-600 uppercase italic'>{cls.day_of_week}</div>
                              <div className='text-[10px] font-bold text-slate-300 mt-1'>{cls.start_time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  )
}
