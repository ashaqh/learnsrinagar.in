import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import { notificationService } from "@/services/notificationService.server"
import { getHomeworkNotification } from "@/services/notificationHelper.server"
import {
  HOMEWORK_CLASS_JOINS,
  HOMEWORK_CLASS_SELECT,
  getTeacherHomeworkAssignments,
  isTeacherAssignedToHomeworkTarget,
} from "@/services/homework.server"

export async function loader({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user) {
    return json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const url = new URL(request.url)
  const classId = url.searchParams.get("classId")
  const studentId = url.searchParams.get("studentId")

  try {
    let homework;
    if (studentId) {
      const parsedStudentId = parseInt(studentId)
      // Verify parent has access to this student
      if (user.role_name === 'parent' && !user.student_ids.includes(parsedStudentId)) {
        return json({ error: "Unauthorized access to student data" }, { status: 403 })
      }
      // Or if it's the student themselves
      if (user.role_name === 'student' && user.id !== parsedStudentId) {
        return json({ error: "Unauthorized access to student data" }, { status: 403 })
      }
      
      homework = await query(
        `SELECT h.*, s.name as subject_name, u.name as teacher_name,
                ${HOMEWORK_CLASS_SELECT}
         FROM homework h 
         JOIN subjects s ON h.subject_id = s.id 
         ${HOMEWORK_CLASS_JOINS}
         JOIN users u ON h.teacher_id = u.id 
         JOIN student_profiles sp ON sp.class_id = COALESCE(h.class_id, s.class_id)
         WHERE sp.user_id = ? 
         ORDER BY h.created_at DESC`,
        [parsedStudentId]
      )
    } else if (classId) {
      homework = await query
(
        `SELECT h.*, s.name as subject_name, u.name as teacher_name,
                ${HOMEWORK_CLASS_SELECT}
         FROM homework h 
         JOIN subjects s ON h.subject_id = s.id 
         ${HOMEWORK_CLASS_JOINS}
         JOIN users u ON h.teacher_id = u.id 
         WHERE COALESCE(h.class_id, s.class_id) = ? 
         ORDER BY h.created_at DESC`,
        [classId]
      )
    } else if (user.role_name === 'teacher') {
      homework = await query(
        `SELECT h.*, s.name as subject_name, u.name as teacher_name,
                ${HOMEWORK_CLASS_SELECT}
         FROM homework h 
         JOIN subjects s ON h.subject_id = s.id
         ${HOMEWORK_CLASS_JOINS}
         JOIN users u ON h.teacher_id = u.id
         WHERE h.teacher_id = ? 
         ORDER BY h.created_at DESC`,
        [user.id]
      )
    } else if (user.role_name === 'school_admin') {
      // School admin sees all homework for subjects in all classes
      homework = await query(
        `SELECT h.*, s.name as subject_name, u.name as teacher_name,
                ${HOMEWORK_CLASS_SELECT}
         FROM homework h 
         JOIN subjects s ON h.subject_id = s.id
         ${HOMEWORK_CLASS_JOINS}
         JOIN users u ON h.teacher_id = u.id 
         ORDER BY h.created_at DESC`
      )
    } else if (user.class_ids && user.class_ids.length > 0) {
      // Student/parent with class_ids
      const placeholders = user.class_ids.map(() => '?').join(',')
      homework = await query(
        `SELECT h.*, s.name as subject_name, u.name as teacher_name,
                ${HOMEWORK_CLASS_SELECT}
         FROM homework h 
         JOIN subjects s ON h.subject_id = s.id
         ${HOMEWORK_CLASS_JOINS}
         JOIN users u ON h.teacher_id = u.id 
         WHERE COALESCE(h.class_id, s.class_id) IN (${placeholders})
         ORDER BY h.created_at DESC`,
        user.class_ids
      )
    } else {
      homework = []
    }

    const response = { homework: homework || [] }

    if (user.role_name === 'teacher') {
      response.assignedSubjects = await getTeacherHomeworkAssignments(user.id)
    }

    return json(response)
  } catch (error) {
    console.error('Homework API Error:', error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function action({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user || user.role_name !== 'teacher') {
    return json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const { classId, subjectId, title, description } = await request.json()

    if (!classId || !subjectId || !title || !description) {
      return json({ error: "Class, subject, title, and description are required" }, { status: 400 })
    }

    const isAssigned = await isTeacherAssignedToHomeworkTarget(
      user.id,
      Number(subjectId),
      Number(classId)
    )

    if (!isAssigned) {
      return json(
        { error: "Please select one of your assigned subject and class combinations" },
        { status: 403 }
      )
    }

    const result = await query(
      `INSERT INTO homework (class_id, subject_id, teacher_id, title, description) 
       VALUES (?, ?, ?, ?, ?)`,
      [classId, subjectId, user.id, title, description]
    )

    try {
      const message = await getHomeworkNotification({
        title,
        classId: Number(classId),
        subjectId: Number(subjectId),
        teacherId: user.id,
      })

      await notificationService.sendNotification({
        title: "New Homework Added",
        message,
        eventType: 'HOMEWORK_ASSIGNED',
        targetType: 'all',
        metadata: {
          homeworkId: result?.insertId ?? null,
          classId: Number(classId),
          subjectId: Number(subjectId),
          homeworkTitle: title,
        },
        senderId: user.id,
      })
    } catch (notifyError) {
      console.error('Failed to send homework notification:', notifyError)
    }

    return json({ success: true, message: "Homework created successfully" })
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
