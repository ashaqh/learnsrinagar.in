import { json } from "@remix-run/node"
import { query, transaction } from "@/lib/db"
import { verifyToken } from "@/lib/auth"

async function authorize(request, method) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user) return null

  if (method === 'GET') {
    if (['super_admin', 'school_admin', 'teacher'].includes(user.role_name)) return user
  } else {
    if (user.role_name === 'super_admin') return user
  }
  return null
}

export async function loader({ request }) {
  const user = await authorize(request, 'GET')
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  try {
    let subjectsQuery = `SELECT DISTINCT s.id, s.name, s.created_at FROM subjects s`
    const subjectsParams = []
    
    if (user.role_name === 'school_admin' || user.role_name === 'teacher') {
      subjectsQuery += `
        JOIN subject_classes sc ON s.id = sc.subject_id
        JOIN classes c ON sc.class_id = c.id
        WHERE c.school_id = ?
      `
      subjectsParams.push(user.school_id)
    }
    
    subjectsQuery += ` ORDER BY s.name ASC`
    const subjects = await query(subjectsQuery, subjectsParams)

    let scQuery = `
      SELECT sc.subject_id, sc.class_id, c.name as class_name
      FROM subject_classes sc
      JOIN classes c ON sc.class_id = c.id
    `
    const scParams = []
    if (user.role_name === 'school_admin' || user.role_name === 'teacher') {
      scQuery += ` WHERE c.school_id = ?`
      scParams.push(user.school_id)
    }
    const subjectClasses = await query(scQuery, scParams)

    const subjectClassMap = {}
    for (const sc of subjectClasses) {
      if (!subjectClassMap[sc.subject_id]) {
        subjectClassMap[sc.subject_id] = []
      }
      subjectClassMap[sc.subject_id].push({
        id: sc.class_id,
        name: sc.class_name,
      })
    }

    const processedSubjects = subjects.map((subject) => ({
      ...subject,
      classes: subjectClassMap[subject.id] || [],
      class_names: (subjectClassMap[subject.id] || [])
        .map((c) => c.name)
        .join(', '),
    }))

    return json({ success: true, subjects: processedSubjects })
  } catch (error) {
    console.error('Subjects Loader Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const method = request.method
  const user = await authorize(request, method)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (method === 'POST') {
      const { name, class_ids } = data // class_ids is an array [1, 2, 3]
      
      const result = await transaction(async (q) => {
        const insertRes = await q(`INSERT INTO subjects (name) VALUES (?)`, [name])
        const subjectId = insertRes.insertId
        
        if (class_ids && class_ids.length > 0) {
          for (const classId of class_ids) {
            await q(`INSERT INTO subject_classes (subject_id, class_id) VALUES (?, ?)`, [subjectId, classId])
          }
        }
        return subjectId
      })
      
      return json({ success: true, message: 'Subject created successfully', id: result })
    }

    if (method === 'PUT') {
      const { id, name, class_ids } = data
      
      await transaction(async (q) => {
        await q(`UPDATE subjects SET name = ? WHERE id = ?`, [name, id])
        
        // Refresh class assignments
        await q(`DELETE FROM subject_classes WHERE subject_id = ?`, [id])
        if (class_ids && class_ids.length > 0) {
          for (const classId of class_ids) {
            await q(`INSERT INTO subject_classes (subject_id, class_id) VALUES (?, ?)`, [id, classId])
          }
        }
      })
      
      return json({ success: true, message: 'Subject updated successfully' })
    }

    if (method === 'DELETE') {
      const { id } = data
      await transaction(async (q) => {
        await q(`DELETE FROM subject_classes WHERE subject_id = ?`, [id])
        await q(`DELETE FROM teacher_assignments WHERE subject_id = ?`, [id])
        await q(`DELETE FROM subjects WHERE id = ?`, [id])
      })
      return json({ success: true, message: 'Subject deleted successfully' })
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin Subject API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
