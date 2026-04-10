import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import {
  calculateLiveClassStatus,
  normalizeLiveClassRecords,
} from "@/lib/liveClassDateTime"

async function buildLearnerDashboardData({
  activeStudentId,
  linkedStudentIds = [],
  includeStudentList = false,
}) {
  const data = {
    activeStudentId,
    studentInfo: null,
    attendance: [],
    timetable: [],
    homework: [],
    allStudents: [],
  }

  if (includeStudentList && linkedStudentIds.length > 0) {
    data.allStudents = await query(
      `SELECT id, name FROM users WHERE id IN (?)`,
      [linkedStudentIds]
    )
  }

  if (!activeStudentId) {
    return data
  }

  const studentInfo = await query(
    `SELECT u.name as student_name, c.name as class_name, sp.class_id
     FROM users u
     JOIN student_profiles sp ON u.id = sp.user_id
     JOIN classes c ON sp.class_id = c.id
     WHERE u.id = ?`,
    [activeStudentId]
  )
  data.studentInfo = studentInfo[0] || null
  const classId = data.studentInfo?.class_id

  data.attendance = await query(
    `SELECT date, status FROM student_attendance
     WHERE student_id = ? ORDER BY date DESC LIMIT 30`,
    [activeStudentId]
  )

  if (!classId) {
    return data
  }

  data.timetable = await query(
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
     WHERE z.class_id = ? 
       AND z.start_time >= CURDATE()
       AND z.start_time <= DATE_ADD(CURDATE(), INTERVAL 8 DAY)
     ORDER BY z.start_time ASC LIMIT 15`,
    [classId]
  )

  data.homework = await query(
    `SELECT h.title, h.description, s.name as subject_name,
            u.name as teacher_name, h.created_at
     FROM homework h
     JOIN subjects s ON h.subject_id = s.id
     JOIN users u ON h.teacher_id = u.id
     WHERE s.class_id = ?
     ORDER BY h.created_at DESC LIMIT 5`,
    [classId]
  )

  return data
}

async function buildTeacherDashboardData({ teacherId, from, to }) {
  const data = {
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

  const formatTeacherDashboardDateKey = (rawDate) => {
    const parsedDate = parseTeacherDashboardDate(rawDate)
    if (!parsedDate) return null

    const year = parsedDate.getFullYear()
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
    const day = String(parsedDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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

  let teacherHomeworkQuery = `
    SELECT h.id,
           h.title,
           h.description,
           h.created_at,
           s.name as subject_name,
           c.name as class_name
    FROM homework h
    JOIN subjects s ON h.subject_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE h.teacher_id = ?
  `
  const teacherHomeworkParams = [teacherId]

  if (from) {
    teacherHomeworkQuery += ` AND DATE(h.created_at) >= ?`
    teacherHomeworkParams.push(from)
  }
  if (to) {
    teacherHomeworkQuery += ` AND DATE(h.created_at) <= ?`
    teacherHomeworkParams.push(to)
  }

  teacherHomeworkQuery += ` ORDER BY h.created_at DESC`
  data.teacherHomework = await query(
    teacherHomeworkQuery,
    teacherHomeworkParams
  )

  let teacherTimetableQuery = `
    SELECT lc.id,
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
  `
  const teacherTimetableParams = [teacherId]

  if (from) {
    teacherTimetableQuery += ` AND DATE(lc.start_time) >= ?`
    teacherTimetableParams.push(from)
  }
  if (to) {
    teacherTimetableQuery += ` AND DATE(lc.start_time) <= ?`
    teacherTimetableParams.push(to)
  }

  teacherTimetableQuery += ` ORDER BY lc.start_time DESC`
  const teacherLiveClasses = normalizeLiveClassRecords(
    await query(
    teacherTimetableQuery,
    teacherTimetableParams
  )
  )

  data.teacherTimetable = teacherLiveClasses
    .map((liveClass) => ({
      ...liveClass,
      dashboard_status: resolveTeacherLiveClassStatus(liveClass),
    }))
    .filter((liveClass) => liveClass.dashboard_status != 'cancelled')

  data.liveClassSummary = Object.values(
    data.teacherTimetable.reduce((acc, liveClass) => {
      const startTime = parseTeacherDashboardDate(liveClass.start_time)
      if (!startTime) return acc

      const sessionDate = formatTeacherDashboardDateKey(startTime)
      if (!sessionDate) return acc
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

  return data
}

export async function loader({ request }) {
  const url = new URL(request.url)
  const school_id = url.searchParams.get("school_id")
  const class_id = url.searchParams.get("class_id")
  const student_id = url.searchParams.get("student_id")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user) {
    return json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const role = user.role_name
  const userId = user.id
  let effective_school_id = school_id
  const allowedClassIds =
    role === 'class_admin' ? (user.class_ids || []).map(String) : []
  const requestedClassId =
    class_id && allowedClassIds.includes(String(class_id)) ? class_id : null
  
  // Enforce school_id for non-super_admins
  if (['school_admin', 'teacher', 'class_admin'].includes(role)) {
    effective_school_id = user.school_id
  }

  const data = {}

  try {
    if (role === 'teacher') {
      Object.assign(
        data,
        await buildTeacherDashboardData({
          teacherId: userId,
          from,
          to,
        })
      )
    } else if (role === 'super_admin' || role === 'school_admin' || role === 'class_admin') {
      // 1. Core Stats
      let statsQuery = 'SELECT '
      const statsParams = []
      
      if (effective_school_id) {
        // For school-specific view, use joins to count correctly
        const teachersCountResult = await query(`
          SELECT COUNT(DISTINCT ta.teacher_id) as count 
          FROM teacher_assignments ta 
          JOIN student_profiles sp ON ta.class_id = sp.class_id
          WHERE sp.schools_id = ?
        `, [effective_school_id])
        
        const studentsCountResult = await query(`
          SELECT COUNT(*) as count 
          FROM student_profiles 
          WHERE schools_id = ?
        `, [effective_school_id])
        
        data.stats = {
          schools: 1,
          teachers: teachersCountResult[0]?.count || 0,
          students: studentsCountResult[0]?.count || 0,
        }
      } else {
        const [{ count: schoolsCount }] = await query('SELECT COUNT(*) as count FROM schools')
        const [{ count: teachersCount }] = await query('SELECT COUNT(*) as count FROM users WHERE role_id = 4')
        const [{ count: studentsCount }] = await query('SELECT COUNT(*) as count FROM users WHERE role_id = 5')
        
        data.stats = {
          schools: schoolsCount,
          teachers: teachersCount,
          students: studentsCount,
        }
      }

      // 2. Attendance Trends
      let attendanceQuery = `
        SELECT date, 
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
               SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
        FROM student_attendance 
        WHERE 1=1
      `
      const attendanceParams = []
      
      if (effective_school_id) {
        attendanceQuery += ` AND student_id IN (SELECT user_id FROM student_profiles WHERE schools_id = ?)`
        attendanceParams.push(effective_school_id)
      }
      if (requestedClassId) {
        attendanceQuery += ` AND class_id = ?`
        attendanceParams.push(requestedClassId)
      } else if (role === 'class_admin' && allowedClassIds.length > 0) {
        attendanceQuery += ` AND class_id IN (${allowedClassIds.map(() => '?').join(',')})`
        attendanceParams.push(...allowedClassIds)
      } else if (class_id) {
        attendanceQuery += ` AND class_id = ?`
        attendanceParams.push(class_id)
      }
      if (from) {
        attendanceQuery += ` AND date >= ?`
        attendanceParams.push(from)
      }
      if (to) {
        attendanceQuery += ` AND date <= ?`
        attendanceParams.push(to)
      } else if (!from) {
        attendanceQuery += ` AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
      }

      attendanceQuery += ` GROUP BY date ORDER BY date ASC`
      data.attendanceTrends = await query(attendanceQuery, attendanceParams)

      // 3. Feedback Stats
      let feedbackQuery = `
        SELECT pfi.section, AVG(pfi.rating) as average 
        FROM parent_feedback_items pfi
        JOIN parent_feedback pf ON pfi.feedback_id = pf.id
        WHERE 1=1
      `
      const feedbackParams = []

      if (effective_school_id) {
        feedbackQuery += ` AND pf.student_id IN (SELECT user_id FROM student_profiles WHERE schools_id = ?)`
        feedbackParams.push(effective_school_id)
      }
      // Note: class_id filtering for feedback might require joining with a student_classes table if it exists, 
      // but assuming school_id for now as per schema.

      feedbackQuery += ` GROUP BY pfi.section`
      const feedbackStats = await query(feedbackQuery, feedbackParams)
      
      const feedbackMap = {}
      feedbackStats.forEach(s => feedbackMap[s.section] = s.average)
      
      data.feedback = {
        academic: (Number(feedbackMap['academic']) || 0).toFixed(1),
        behavioral: (Number(feedbackMap['behavioral']) || 0).toFixed(1),
        satisfaction: Math.round(((Number(feedbackMap['satisfaction']) || 0) / 5) * 100)
      }

      // 4. Recent Feedback Items
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

      let feedbackItemsQuery = `
        SELECT pf.id as submission_id, pf.created_at, pf.title,
               u_s.name as student_name, u_p.name as parent_name,
               pfi.section, pfi.statement_id, pfi.rating, pfi.comment
        FROM parent_feedback pf
        LEFT JOIN users u_s ON pf.student_id = u_s.id
        LEFT JOIN student_profiles sp ON u_s.id = sp.user_id
        LEFT JOIN users u_p ON pf.parent_id = u_p.id
        JOIN parent_feedback_items pfi ON pf.id = pfi.feedback_id
        WHERE 1=1
      `
      const feedbackItemsParams = []
      if (effective_school_id) {
        feedbackItemsQuery += ` AND sp.schools_id = ?`
        feedbackItemsParams.push(effective_school_id)
      }
      feedbackItemsQuery += ` ORDER BY pf.created_at DESC LIMIT 20`
      
      const rawFeedbackItems = await query(feedbackItemsQuery, feedbackItemsParams)
      
      // Group by submission_id
      const feedbackSubmissions = {}
      rawFeedbackItems.forEach(item => {
        if (!feedbackSubmissions[item.submission_id]) {
          feedbackSubmissions[item.submission_id] = {
            id: item.submission_id,
            student_name: item.student_name,
            parent_name: item.parent_name,
            created_at: item.created_at,
            title: item.title,
            items: []
          }
        }

        const questionText = feedbackStatements[item.section] && feedbackStatements[item.section][item.statement_id]
          ? feedbackStatements[item.section][item.statement_id]
          : 'Question not found'

        feedbackSubmissions[item.submission_id].items.push({
          section: item.section,
          question: questionText,
          rating: item.rating,
          comment: item.comment
        })
      })
      
      data.recentFeedback = Object.values(feedbackSubmissions)

      let liveClassSummaryQuery = `
        SELECT DATE(lc.start_time) as session_date,
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
      `
      const liveClassSummaryParams = []

      if (effective_school_id) {
        liveClassSummaryQuery += ` AND (lc.school_id = ? OR lc.is_all_schools = 1)`
        liveClassSummaryParams.push(effective_school_id)
      }
      if (requestedClassId) {
        liveClassSummaryQuery += ` AND lc.class_id = ?`
        liveClassSummaryParams.push(requestedClassId)
      } else if (role === 'class_admin' && allowedClassIds.length > 0) {
        liveClassSummaryQuery += ` AND lc.class_id IN (${allowedClassIds.map(() => '?').join(',')})`
        liveClassSummaryParams.push(...allowedClassIds)
      } else if (class_id) {
        liveClassSummaryQuery += ` AND lc.class_id = ?`
        liveClassSummaryParams.push(class_id)
      }
      if (from) {
        liveClassSummaryQuery += ` AND DATE(lc.start_time) >= ?`
        liveClassSummaryParams.push(from)
      }
      if (to) {
        liveClassSummaryQuery += ` AND DATE(lc.start_time) <= ?`
        liveClassSummaryParams.push(to)
      }

      liveClassSummaryQuery += `
        GROUP BY DATE(lc.start_time)
        ORDER BY session_date DESC
      `
      data.liveClassSummary = await query(
        liveClassSummaryQuery,
        liveClassSummaryParams
      )

      let schoolAttendanceSummaryQuery = `
        SELECT s.id as school_id,
               s.name as school_name,
               SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM student_attendance sa
        JOIN student_profiles sp ON sa.student_id = sp.user_id
        JOIN schools s ON sp.schools_id = s.id
        JOIN classes c ON sa.class_id = c.id
        WHERE 1 = 1
      `
      const schoolAttendanceSummaryParams = []

      if (effective_school_id) {
        schoolAttendanceSummaryQuery += ` AND sp.schools_id = ?`
        schoolAttendanceSummaryParams.push(effective_school_id)
      }
      if (requestedClassId) {
        schoolAttendanceSummaryQuery += ` AND sa.class_id = ?`
        schoolAttendanceSummaryParams.push(requestedClassId)
      } else if (role === 'class_admin' && allowedClassIds.length > 0) {
        schoolAttendanceSummaryQuery += ` AND sa.class_id IN (${allowedClassIds.map(() => '?').join(',')})`
        schoolAttendanceSummaryParams.push(...allowedClassIds)
      } else if (class_id) {
        schoolAttendanceSummaryQuery += ` AND sa.class_id = ?`
        schoolAttendanceSummaryParams.push(class_id)
      }
      if (from) {
        schoolAttendanceSummaryQuery += ` AND sa.date >= ?`
        schoolAttendanceSummaryParams.push(from)
      }
      if (to) {
        schoolAttendanceSummaryQuery += ` AND sa.date <= ?`
        schoolAttendanceSummaryParams.push(to)
      }

      schoolAttendanceSummaryQuery += `
        GROUP BY s.id, s.name
        ORDER BY s.name ASC
      `
      data.schoolAttendanceSummary = await query(
        schoolAttendanceSummaryQuery,
        schoolAttendanceSummaryParams
      )

      if (role === 'school_admin' || role === 'class_admin') {
        let schoolHomeworkQuery = `
          SELECT h.id,
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
        `
        const schoolHomeworkParams = [effective_school_id]

        if (requestedClassId) {
          schoolHomeworkQuery += ` AND COALESCE(h.class_id, s.class_id) = ?`
          schoolHomeworkParams.push(requestedClassId)
        } else if (role === 'class_admin' && allowedClassIds.length > 0) {
          schoolHomeworkQuery += ` AND COALESCE(h.class_id, s.class_id) IN (${allowedClassIds.map(() => '?').join(',')})`
          schoolHomeworkParams.push(...allowedClassIds)
        } else if (class_id) {
          schoolHomeworkQuery += ` AND COALESCE(h.class_id, s.class_id) = ?`
          schoolHomeworkParams.push(class_id)
        }
        if (from) {
          schoolHomeworkQuery += ` AND DATE(h.created_at) >= ?`
          schoolHomeworkParams.push(from)
        }
        if (to) {
          schoolHomeworkQuery += ` AND DATE(h.created_at) <= ?`
          schoolHomeworkParams.push(to)
        }

        schoolHomeworkQuery += ` ORDER BY h.created_at DESC LIMIT 10`
        data.schoolHomework = await query(
          schoolHomeworkQuery,
          schoolHomeworkParams
        )
      }

      // 5. Filter Lists
      if (effective_school_id) {
        data.schoolsList = await query('SELECT id, name FROM schools WHERE id = ?', [effective_school_id])
        if (role === 'class_admin' && allowedClassIds.length > 0) {
          data.classesList = await query(
            `SELECT id, name
             FROM classes
             WHERE id IN (${allowedClassIds.map(() => '?').join(',')})
             ORDER BY name ASC`,
            allowedClassIds
          )
        } else {
          data.classesList = await query(
            `SELECT DISTINCT c.id, c.name
             FROM classes c
             JOIN student_profiles sp ON sp.class_id = c.id
             WHERE sp.schools_id = ?
             ORDER BY c.name ASC`,
            [effective_school_id]
          )
        }
      } else {
        data.schoolsList = await query('SELECT id, name FROM schools ORDER BY name ASC')
        data.classesList = await query('SELECT id, name FROM classes ORDER BY name ASC')
      }
    } else if (role === 'student') {
      Object.assign(
        data,
        await buildLearnerDashboardData({
          activeStudentId: userId,
        })
      )
    } else if (role === 'parent') {
      // Resolve linked students
      const studentIds = user.student_ids || []
      if (studentIds.length > 0) {
        const activeStudentId = (student_id && studentIds.includes(Number(student_id))) 
          ? Number(student_id) 
          : studentIds[0]

        Object.assign(
          data,
          await buildLearnerDashboardData({
            activeStudentId,
            linkedStudentIds: studentIds,
            includeStudentList: true,
          })
        )

        // Attendance — last 30 days summary

        // Timetable — upcoming live classes for their class (next 7 days)
        // Includes today's classes

        // Homework — latest 5 for their class

        data.linkedStudentIds = studentIds
      }
    }

    return json({ success: true, user, data })
  } catch (error) {
    console.error("Dashboard API Error:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
