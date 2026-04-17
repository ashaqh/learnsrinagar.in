import { json } from "@remix-run/node"
import { query, transaction } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from 'bcryptjs'
import { notificationService } from "@/services/notificationService.server"
import { getClassAdminLifecycleNotification } from "@/services/notificationHelper.server"

async function authorize(request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)
  if (!user || !['super_admin', 'school_admin'].includes(user.role_name)) return null
  return user
}

async function resolveEffectiveSchoolId(user, requestedSchoolId = null) {
  if (user?.role_name !== 'school_admin') {
    return requestedSchoolId || user?.school_id || null
  }

  if (user.school_id) {
    return user.school_id
  }

  if (requestedSchoolId) {
    return requestedSchoolId
  }

  const schools = await query(
    'SELECT id FROM schools WHERE users_id = ? LIMIT 1',
    [user.id]
  )

  return schools[0]?.id || null
}

export async function loader({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const requestedSchoolId = url.searchParams.get('school_id')
  const school_id = await resolveEffectiveSchoolId(user, requestedSchoolId)

  try {
    // For school_admin, ensure they only see their own school
    let sql = `
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
      WHERE 1=1
    `
    const params = []

    if (school_id) {
       sql += " AND ca.school_id = ?"
       params.push(school_id)
    }

    const classAdmins = await query(sql, params)
    
    // Also fetch classes and schools for dropdowns if needed
    const classes = school_id
      ? await query('SELECT id, name FROM classes WHERE school_id = ? ORDER BY name', [school_id])
      : await query('SELECT id, name FROM classes ORDER BY name')
    const schools = school_id
      ? await query('SELECT id, name FROM schools WHERE id = ? ORDER BY name', [school_id])
      : await query('SELECT id, name FROM schools ORDER BY name')

    return json({ success: true, classAdmins, classes, schools })
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function action({ request }) {
  const user = await authorize(request)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const method = request.method
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (method === 'POST') {
      const { name, email, password, class_id } = data
      const school_id = await resolveEffectiveSchoolId(user, data.school_id)
      let admin_id = null

      if (!name || !email || !password || !school_id || !class_id) {
        return json({ success: false, message: 'Missing required fields' }, { status: 400 })
      }

      // Check if user exists
      const exists = await query('SELECT id FROM users WHERE email = ?', [email])
      if (exists.length > 0) {
        return json({ success: false, message: 'A user with this email already exists.' }, { status: 400 })
      }

      // Use transaction helper
      try {
        await transaction(async (q) => {
          const salt = await bcrypt.genSalt(10)
          const password_hash = await bcrypt.hash(password, salt)
          const result = await q(
            'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, 3)',
            [name, email, password_hash]
          )

          admin_id = result.insertId

          await q(
            'INSERT INTO class_admins (admin_id, school_id, class_id) VALUES (?, ?, ?)',
            [admin_id, school_id, class_id]
          )
        })

        try {
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
            senderId: user.id,
          })
        } catch (notifyError) {
          console.error('Failed to send class admin creation notification:', notifyError)
        }

        return json({ success: true, message: 'Class admin created and assigned successfully' })
      } catch (err) {
        throw err
      }
    }

    if (method === 'PUT') {
      const { id, admin_id, name, email, password, class_id } = data
      const school_id = await resolveEffectiveSchoolId(user, data.school_id)

      if (!id || !admin_id || !name || !email || !school_id || !class_id) {
        return json({ success: false, message: 'Missing required fields' }, { status: 400 })
      }

      // Check for email conflicts
      const emailExists = await query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, admin_id]
      )

      if (emailExists.length > 0) {
        return json({ success: false, message: 'A user with this email already exists.' }, { status: 400 })
      }

      // Use transaction helper
      try {
        await transaction(async (q) => {
          if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10)
            const password_hash = await bcrypt.hash(password, salt)
            await q(
              `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`,
              [name, email, password_hash, admin_id]
            )
          } else {
            await q(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [name, email, admin_id])
          }

          // Update assignment
          await q(
            `UPDATE class_admins SET school_id = ?, class_id = ? WHERE id = ?`,
            [school_id, class_id, id]
          )
        })

        return json({ success: true, message: 'Class admin updated successfully' })
      } catch (err) {
        throw err
      }
    }

    if (method === 'DELETE') {
      const { id, admin_id } = data
      if (!id) return json({ success: false, message: 'Missing ID' }, { status: 400 })
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
        return json({ success: false, message: 'Class admin assignment not found' }, { status: 404 })
      }

      if (
        user.role_name === 'school_admin' &&
        String(existingAssignment[0].school_id) !== String(await resolveEffectiveSchoolId(user))
      ) {
        return json({ success: false, message: 'Forbidden' }, { status: 403 })
      }

      // Use transaction helper
      try {
        await transaction(async (q) => {
          await q('DELETE FROM class_admins WHERE id = ?', [id])
          // If we also want to delete the user:
          if (admin_id) {
            await q('DELETE FROM users WHERE id = ?', [admin_id])
          }
        })

        try {
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
            senderId: user.id,
          })
        } catch (notifyError) {
          console.error('Failed to send class admin deletion notification:', notifyError)
        }

        return json({ success: true, message: 'Class admin deleted successfully' })
      } catch (err) {
        throw err
      }
    }

    return json({ success: false, message: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Admin Class Admin API Error:', error)
    return json({ success: false, message: error.message }, { status: 500 })
  }
}
