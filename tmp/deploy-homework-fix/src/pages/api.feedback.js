import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"

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
  const feedbackId = url.searchParams.get("id")

  try {
    if (feedbackId) {
      // Get detailed items for a specific feedback
      const main = await query(
        `SELECT f.id, f.title, f.created_at, p.name as parent_name, s.name as student_name
         FROM parent_feedback f
         JOIN users p ON f.parent_id = p.id
         JOIN users s ON f.student_id = s.id
         WHERE f.id = ?`,
        [feedbackId]
      )

      if (main.length === 0) {
        return json({ error: "Feedback not found" }, { status: 404 })
      }

      const items = await query(
        `SELECT section, statement_id, rating, comment
         FROM parent_feedback_items
         WHERE feedback_id = ?`,
        [feedbackId]
      )

      const detailedItems = items.map(item => ({
        ...item,
        statement: feedbackStatements[item.section][item.statement_id] || "Unknown statement"
      }))

      return json({ feedback: main[0], items: detailedItems })
    }

    let feedback;
    if (user.role_name === 'parent') {
      feedback = await query(
        `SELECT f.id, f.title, f.description, f.created_at, f.student_id, f.parent_id,
                p.name AS parent_name, s.name AS student_name
         FROM parent_feedback f
         JOIN users p ON f.parent_id = p.id
         JOIN users s ON f.student_id = s.id
         WHERE f.parent_id = ?
         ORDER BY f.created_at DESC`,
        [user.id]
      )
    } else if (['super_admin', 'school_admin', 'class_admin'].includes(user.role_name)) {
      feedback = await query(
        `SELECT f.id, f.title, f.description, f.created_at, f.student_id, f.parent_id,
                p.name AS parent_name, s.name AS student_name
         FROM parent_feedback f
         JOIN users p ON f.parent_id = p.id
         JOIN users s ON f.student_id = s.id
         ORDER BY f.created_at DESC`
      )
    } else if (user.role_name === 'teacher') {
      feedback = await query(
        `SELECT f.id, f.title, f.description, f.created_at, f.student_id, f.parent_id,
                p.name AS parent_name, s.name AS student_name
         FROM parent_feedback f
         JOIN users p ON f.parent_id = p.id
         JOIN users s ON f.student_id = s.id
         ORDER BY f.created_at DESC`
      )
    }

    return json({ feedback: feedback || [] })
  } catch (error) {
    console.error("Feedback loader error:", error)
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

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { title, student_id, items, feedbackId, response } = body

    if (request.method === "POST" && user.role_name === 'parent') {
      // Validate parent owns this student
      if (student_id && user.student_ids && !user.student_ids.includes(parseInt(student_id))) {
        return json({ error: "Unauthorized: student not linked to this parent" }, { status: 403 })
      }

      const finalStudentId = student_id || (user.student_ids?.length > 0 ? user.student_ids[0] : null)

      // Insert main feedback record
      const result = await query(
        `INSERT INTO parent_feedback (title, parent_id, student_id) VALUES (?, ?, ?)`,
        [title, user.id, finalStudentId]
      )
      const newFeedbackId = result.insertId

      // Insert individual statement ratings
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await query(
            `INSERT INTO parent_feedback_items (feedback_id, section, statement_id, rating, comment) VALUES (?, ?, ?, ?, ?)`,
            [newFeedbackId, item.section, item.statement_id, item.rating, item.comment || null]
          )
        }
      }

      // Notify admins
      try {
        const { notificationService } = await import("@/services/notificationService.server");
        await notificationService.sendNotification({
          title: "New Parent Feedback",
          message: `${user.name} submitted feedback.`,
          eventType: 'FEEDBACK_ADDED_ADMIN',
          targetType: 'role',
          targetId: 'school_admin'
        });
      } catch (notifyError) {
        console.error('Failed to send feedback notification:', notifyError);
      }

      return json({ success: true, message: "Feedback submitted successfully" })
    } else if (request.method === "PUT" && user.role_name === 'teacher') {
      await query(
        `UPDATE feedback SET response = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND teacher_id = ?`,
        [response, feedbackId, user.id]
      )

      try {
        const feedbackRows = await query('SELECT student_id FROM feedback WHERE id = ?', [feedbackId]);
        if (feedbackRows.length > 0) {
          const { notificationService } = await import("@/services/notificationService.server");
          await notificationService.sendNotification({
            title: "Teacher Responded to Feedback",
            message: `${user.name} has responded to your feedback.`,
            eventType: 'FEEDBACK_RESPONSE',
            targetType: 'user',
            targetId: feedbackRows[0].student_id
          });
        }
      } catch (notifyError) {
        console.error('Failed to send feedback response notification:', notifyError);
      }

      return json({ success: true, message: "Response sent successfully" })
    }

    return json({ error: "Action not permitted" }, { status: 403 })
  } catch (error) {
    console.error("Feedback action error:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
