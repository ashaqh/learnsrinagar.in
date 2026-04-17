import { query } from '@/lib/db'

export const HOMEWORK_CLASS_JOINS = `
  LEFT JOIN classes cs ON s.class_id = cs.id
  LEFT JOIN classes ch ON h.class_id = ch.id
`

export const HOMEWORK_CLASS_SELECT = `
  COALESCE(h.class_id, s.class_id) AS class_id,
  COALESCE(ch.name, cs.name, 'Unassigned Class') AS class_name
`

export function buildHomeworkAssignmentValue(subjectId, classId) {
  if (!subjectId || !classId) return ''
  return `${subjectId}:${classId}`
}

export function parseHomeworkAssignmentValue(value) {
  if (!value) {
    return { subjectId: null, classId: null }
  }

  const [rawSubjectId, rawClassId] = String(value).split(':')
  const subjectId = Number.parseInt(rawSubjectId, 10)
  const classId = Number.parseInt(rawClassId, 10)

  if (!Number.isInteger(subjectId) || !Number.isInteger(classId)) {
    return { subjectId: null, classId: null }
  }

  return { subjectId, classId }
}

export async function getTeacherHomeworkAssignments(teacherId) {
  const assignments = await query(
    `SELECT ta.id AS id,
            ta.teacher_id,
            ta.subject_id,
            ta.class_id,
            s.name AS subject_name,
            s.name AS name,
            c.name AS class_name
     FROM teacher_assignments ta
     JOIN subjects s ON ta.subject_id = s.id
     JOIN classes c ON ta.class_id = c.id
     WHERE ta.teacher_id = ?
     ORDER BY c.name, s.name`,
    [teacherId]
  )

  return assignments.map((assignment) => ({
    ...assignment,
    assignment_key: buildHomeworkAssignmentValue(
      assignment.subject_id,
      assignment.class_id
    ),
  }))
}

export async function isTeacherAssignedToHomeworkTarget(
  teacherId,
  subjectId,
  classId
) {
  if (!teacherId || !subjectId || !classId) {
    return false
  }

  const assignment = await query(
    `SELECT id
     FROM teacher_assignments
     WHERE teacher_id = ? AND subject_id = ? AND class_id = ?
     LIMIT 1`,
    [teacherId, subjectId, classId]
  )

  return assignment.length > 0
}
