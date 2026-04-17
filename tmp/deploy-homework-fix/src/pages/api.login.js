import { json } from "@remix-run/node"
import bcrypt from 'bcryptjs'
import { query } from "@/lib/db"
import { generateToken } from "@/lib/auth"

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 })
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return json({ error: "Email and password are required" }, { status: 400 })
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return json({ error: "Invalid credentials" }, { status: 401 })
    }

    const user = users[0];
    let passwordHash = user.password_hash;
    
    // Fix bcrypt format if needed ($2b$ -> $2a$)
    if (passwordHash.startsWith('$2b$')) {
        passwordHash = passwordHash.replace('$2b$', '$2a$');
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    
    if (!isValid) {
      return json({ error: "Invalid credentials" }, { status: 401 })
    }

    const roles = await query(`SELECT name FROM roles WHERE id = ?`, [user.role_id])
    const role = roles?.[0]

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role_name: role.name,
      school_id: null,
      class_ids: [],
      student_ids: [],
      subject_ids: [],
    }

    // Role-specific data fetching (mirrored from login.jsx)
    if (role) {
      const roleName = role.name

      if (roleName === 'student') {
        const studentProfiles = await query(
          `SELECT class_id, schools_id as school_id FROM student_profiles WHERE user_id = ?`,
          [user.id]
        )
        if (studentProfiles?.length > 0) {
          sessionUser.class_ids = [studentProfiles[0].class_id]
          sessionUser.school_id = studentProfiles[0].school_id
        }
      } else if (roleName === 'teacher') {
        const teacherSubjects = await query(
          `SELECT subject_id FROM teacher_assignments WHERE teacher_id = ?`,
          [user.id]
        )
        if (teacherSubjects?.length > 0) {
          sessionUser.subject_ids = teacherSubjects.map((item) => item.subject_id)
        }
        const teacherClasses = await query(
          `SELECT DISTINCT ta.class_id
           FROM teacher_assignments ta
           WHERE ta.teacher_id = ?`,
          [user.id]
        )
        if (teacherClasses?.length > 0) {
          sessionUser.class_ids = teacherClasses.map((item) => item.class_id)
        }
      } else if (roleName === 'parent') {
        const parentLinks = await query(
          `SELECT student_id FROM parent_student_links WHERE parent_id = ?`,
          [user.id]
        )
        if (parentLinks?.length > 0) {
          sessionUser.student_ids = parentLinks.map((link) => link.student_id)
        }
      } else if (roleName === 'class_admin') {
        const classAdmins = await query(
          `SELECT school_id, class_id FROM class_admins WHERE admin_id = ?`,
          [user.id]
        )
        if (classAdmins?.length > 0) {
          sessionUser.school_id = classAdmins[0].school_id
          sessionUser.class_ids = classAdmins.map((item) => item.class_id)
        }
      } else if (roleName === 'school_admin') {
        const schools = await query(
          `SELECT id as school_id FROM schools WHERE users_id = ? LIMIT 1`,
          [user.id]
        )
        if (schools?.length > 0) {
          sessionUser.school_id = schools[0].school_id
        }
      }
    }

    const token = generateToken(sessionUser)

    return json({
      token,
      user: sessionUser
    })
  } catch (error) {
    console.error("API Login Error:", error)
    return json({ error: "Server error occurred" }, { status: 500 })
  }
}
