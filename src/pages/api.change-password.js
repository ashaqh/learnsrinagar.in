import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 })
  }

  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user) {
    return json({ error: "Invalid or expired token" }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword, confirmPassword } = await request.json()
    const normalizedConfirmPassword = confirmPassword ?? newPassword

    if (!currentPassword || !newPassword) {
      return json(
        { success: false, message: "Current password and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword !== normalizedConfirmPassword) {
      return json({ success: false, message: "New passwords do not match" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 })
    }

    const users = await query('SELECT password_hash FROM users WHERE id = ?', [user.id])
    if (users.length === 0) {
      return json({ success: false, message: "User not found" }, { status: 404 })
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, users[0].password_hash)
    if (!isCurrentValid) {
      return json({ success: false, message: "Current password is incorrect" }, { status: 400 })
    }

    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(newPassword, salt)

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, user.id])

    return json({ success: true, message: "Password changed successfully" })
  } catch (error) {
    console.error("Change Password API Error:", error)
    return json(
      { success: false, message: "An error occurred while changing password" },
      { status: 500 }
    )
  }
}
