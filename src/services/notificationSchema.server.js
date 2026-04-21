import { query } from '@/lib/db'

let ensureNotificationSchemaPromise = null

const notificationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS notifications (
    id int NOT NULL AUTO_INCREMENT,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    type enum('system', 'manual') NOT NULL DEFAULT 'system',
    event_type varchar(50) DEFAULT NULL,
    target_type enum('all', 'role', 'group', 'class', 'school', 'user') NOT NULL,
    target_id varchar(100) DEFAULT NULL,
    metadata json DEFAULT NULL,
    created_by int DEFAULT NULL,
    created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_created_at (created_at),
    KEY idx_notifications_target (target_type, target_id),
    CONSTRAINT notifications_ibfk_1 FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `ALTER TABLE notifications
   MODIFY COLUMN target_type enum('all', 'role', 'group', 'class', 'school', 'user') NOT NULL`,
  `CREATE TABLE IF NOT EXISTS user_notifications (
    id int NOT NULL AUTO_INCREMENT,
    user_id int NOT NULL,
    notification_id int NOT NULL,
    is_read tinyint(1) DEFAULT '0',
    delivered_at timestamp NULL DEFAULT NULL,
    read_at timestamp NULL DEFAULT NULL,
    created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_user_notification (user_id, notification_id),
    KEY idx_user_notifications_read (user_id, is_read),
    KEY idx_user_notifications_notification (notification_id),
    CONSTRAINT user_notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT user_notifications_ibfk_2 FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS device_tokens (
    id int NOT NULL AUTO_INCREMENT,
    user_id int NOT NULL,
    token text NOT NULL,
    device_type enum('android', 'ios', 'web') DEFAULT 'android',
    last_updated timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY token_unique (token(255)),
    KEY idx_device_tokens_user_id (user_id),
    CONSTRAINT device_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS notification_settings (
    user_id int NOT NULL,
    classes_enabled tinyint(1) DEFAULT '1',
    blogs_enabled tinyint(1) DEFAULT '1',
    feedback_enabled tinyint(1) DEFAULT '1',
    is_muted tinyint(1) DEFAULT '0',
    PRIMARY KEY (user_id),
    CONSTRAINT notification_settings_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `INSERT IGNORE INTO notification_settings (user_id)
   SELECT id FROM users`,
  // G1 — Add is_active column to users if not already present
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active tinyint(1) NOT NULL DEFAULT 1`,
  // Back-fill existing rows: treat all current users as active
  `UPDATE users SET is_active = 1 WHERE is_active IS NULL`,
  // FP-02 — Notification dispatch audit log with retry support
  `CREATE TABLE IF NOT EXISTS notification_dispatch_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NULL,
    homework_id     INT NULL,
    class_id        INT NOT NULL,
    school_id       INT NULL,
    sender_id       INT NOT NULL,
    status          ENUM('pending','success','partial','failed','dead') NOT NULL DEFAULT 'pending',
    mysql_ok        TINYINT(1) NOT NULL DEFAULT 0,
    firestore_ok    TINYINT(1) NOT NULL DEFAULT 0,
    fcm_topic_ok    TINYINT(1) NOT NULL DEFAULT 0,
    fcm_push_ok     TINYINT(1) NOT NULL DEFAULT 0,
    recipient_count INT NOT NULL DEFAULT 0,
    error_detail    TEXT,
    retry_count     TINYINT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMP NULL,
    created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dispatch_status_retry (status, next_retry_at),
    KEY idx_dispatch_homework (homework_id),
    CONSTRAINT fk_dispatch_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
]

export async function ensureNotificationSchema() {
  if (!ensureNotificationSchemaPromise) {
    ensureNotificationSchemaPromise = (async () => {
      for (const statement of notificationSchemaStatements) {
        await query(statement)
      }
    })().catch((error) => {
      ensureNotificationSchemaPromise = null
      throw error
    })
  }

  return ensureNotificationSchemaPromise
}

export async function getNotificationsForUser(userId, limit = 50) {
  await ensureNotificationSchema()

  const notifications = await query(
    `
      SELECT
        n.*,
        un.is_read,
        un.delivered_at,
        un.read_at
      FROM notifications n
      JOIN user_notifications un ON n.id = un.notification_id
      WHERE un.user_id = ?
      ORDER BY COALESCE(un.delivered_at, un.created_at, n.created_at) DESC, n.id DESC
      LIMIT ?
    `,
    [userId, Number(limit)]
  )

  const unreadRows = await query(
    `
      SELECT COUNT(*) AS unreadCount
      FROM user_notifications
      WHERE user_id = ? AND is_read = 0
    `,
    [userId]
  )

  return {
    notifications,
    unreadCount: Number(unreadRows[0]?.unreadCount ?? 0),
  }
}

export async function markNotificationsRead(userId, notificationId = null) {
  await ensureNotificationSchema()

  const normalizedNotificationId =
    notificationId === null ||
    notificationId === undefined ||
    notificationId === ''
      ? null
      : Number(notificationId)

  if (normalizedNotificationId) {
    await query(
      `
        UPDATE user_notifications
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND notification_id = ?
      `,
      [userId, normalizedNotificationId]
    )
    return
  }

  await query(
    `
      UPDATE user_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_read = 0
    `,
    [userId]
  )
}

function toPositiveInt(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function resolveNotificationRecipientIds(
  targetType = 'all',
  targetId = null,
  audienceContext = {}
) {
  await ensureNotificationSchema()

  const scopedSchoolId = toPositiveInt(audienceContext?.schoolId)

  if (targetType === 'all') {
    const rows = await query('SELECT id FROM users')
    return rows.map((row) => row.id)
  }

  if (targetType === 'role') {
    const rows = await query(
      `
        SELECT u.id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = ?
      `,
      [targetId]
    )
    return rows.map((row) => row.id)
  }

  if (targetType === 'user') {
    const userId = toPositiveInt(targetId)
    return userId ? [userId] : []
  }

  if (targetType === 'school') {
    const schoolId = toPositiveInt(targetId)
    if (!schoolId) return []

    const [schoolAdmins, classAdmins, students, parents, teachers] = await Promise.all([
      query('SELECT users_id AS id FROM schools WHERE id = ?', [schoolId]),
      query('SELECT DISTINCT admin_id AS id FROM class_admins WHERE school_id = ?', [
        schoolId,
      ]),
      query('SELECT DISTINCT user_id AS id FROM student_profiles WHERE schools_id = ?', [
        schoolId,
      ]),
      query(
        `
          SELECT DISTINCT psl.parent_id AS id
          FROM parent_student_links psl
          JOIN student_profiles sp ON sp.user_id = psl.student_id
          WHERE sp.schools_id = ?
        `,
        [schoolId]
      ),
      query(
        `
          SELECT DISTINCT ta.teacher_id AS id
          FROM teacher_assignments ta
          JOIN student_profiles sp ON sp.class_id = ta.class_id
          WHERE sp.schools_id = ?
        `,
        [schoolId]
      ),
    ])

    return [
      ...new Set(
        [...schoolAdmins, ...classAdmins, ...students, ...parents, ...teachers]
          .map((row) => row.id)
          .filter(Boolean)
      ),
    ]
  }

  if (targetType === 'group' || targetType === 'class') {
    const classId = toPositiveInt(targetId)
    if (!classId) return []

    const [students, parents, teachers, classAdmins, schoolAdmins] =
      scopedSchoolId
        ? await Promise.all([
            query(
              'SELECT DISTINCT user_id AS id FROM student_profiles WHERE class_id = ? AND schools_id = ?',
              [classId, scopedSchoolId]
            ),
            query(
              `
                SELECT DISTINCT psl.parent_id AS id
                FROM parent_student_links psl
                JOIN student_profiles sp ON sp.user_id = psl.student_id
                WHERE sp.class_id = ? AND sp.schools_id = ?
              `,
              [classId, scopedSchoolId]
            ),
            query(
              `
                SELECT DISTINCT ta.teacher_id AS id
                FROM teacher_assignments ta
                JOIN student_profiles sp ON sp.class_id = ta.class_id
                WHERE sp.class_id = ? AND sp.schools_id = ?
              `,
              [classId, scopedSchoolId]
            ),
            query(
              'SELECT DISTINCT admin_id AS id FROM class_admins WHERE class_id = ? AND school_id = ?',
              [classId, scopedSchoolId]
            ),
            query('SELECT DISTINCT users_id AS id FROM schools WHERE id = ?', [scopedSchoolId]),
          ])
        : await Promise.all([
            query('SELECT DISTINCT user_id AS id FROM student_profiles WHERE class_id = ?', [
              classId,
            ]),
            query(
              `
                SELECT DISTINCT psl.parent_id AS id
                FROM parent_student_links psl
                JOIN student_profiles sp ON sp.user_id = psl.student_id
                WHERE sp.class_id = ?
              `,
              [classId]
            ),
            query(
              'SELECT DISTINCT teacher_id AS id FROM teacher_assignments WHERE class_id = ?',
              [classId]
            ),
            query('SELECT DISTINCT admin_id AS id FROM class_admins WHERE class_id = ?', [
              classId,
            ]),
            query(
              `
                SELECT DISTINCT s.users_id AS id
                FROM schools s
                JOIN student_profiles sp ON sp.schools_id = s.id
                WHERE sp.class_id = ?
              `,
              [classId]
            ),
          ])

    return [
      ...new Set(
        [...students, ...parents, ...teachers, ...classAdmins, ...schoolAdmins]
          .map((row) => row.id)
          .filter(Boolean)
      ),
    ]
  }

  return []
}

/**
 * Resolves all relevant users for a homework assignment event.
 * Includes: Super Admins, School Admins, Teachers (in school),
 * Class Admins (in class), Students (in class), and Parents (linked to students in class).
 *
 * G1 — Only active users (is_active = 1) are included.
 * G2 — The sender (teacher who assigned homework) is excluded from results.
 *
 * @param {number} classId
 * @param {number} schoolId
 * @param {number|null} senderId - User ID of the teacher who triggered the event (excluded from results)
 */
export async function getAllRelevantHomeworkRecipients(classId, schoolId, senderId = null) {
  await ensureNotificationSchema()

  const normalizedClassId = toPositiveInt(classId)
  const normalizedSchoolId = toPositiveInt(schoolId)

  if (!normalizedClassId || !normalizedSchoolId) {
    console.warn('[NotificationSchema] Missing classId or schoolId for homework recipients resolution')
    return []
  }

  const [
    superAdmins,
    schoolAdmins,
    teachers,
    classAdmins,
    students,
    parents
  ] = await Promise.all([
    // 1. Super Admins — active only
    query(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'super_admin'
        AND u.is_active = 1
    `),
    // 2. School Admin for this specific school — active only
    query(`
      SELECT u.id
      FROM schools s
      JOIN users u ON u.id = s.users_id
      WHERE s.id = ?
        AND u.is_active = 1
    `, [normalizedSchoolId]),
    // 3. Teachers assigned to any class in this school — active only
    query(`
      SELECT DISTINCT ta.teacher_id AS id
      FROM teacher_assignments ta
      JOIN student_profiles sp ON sp.class_id = ta.class_id
      JOIN users u ON u.id = ta.teacher_id
      WHERE sp.schools_id = ?
        AND u.is_active = 1
    `, [normalizedSchoolId]),
    // 4. Class Admins for this class — active only
    query(`
      SELECT ca.admin_id AS id
      FROM class_admins ca
      JOIN users u ON u.id = ca.admin_id
      WHERE ca.class_id = ?
        AND u.is_active = 1
    `, [normalizedClassId]),
    // 5. Students enrolled in this class — active only
    query(`
      SELECT sp.user_id AS id
      FROM student_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.class_id = ?
        AND u.is_active = 1
    `, [normalizedClassId]),
    // 6. Parents of students in this class — active only
    query(`
      SELECT DISTINCT psl.parent_id AS id
      FROM parent_student_links psl
      JOIN student_profiles sp ON sp.user_id = psl.student_id
      JOIN users u ON u.id = psl.parent_id
      WHERE sp.class_id = ?
        AND u.is_active = 1
    `, [normalizedClassId])
  ])

  // Combine, deduplicate, and exclude the sender (G2)
  const normalizedSenderId = toPositiveInt(senderId)
  const allUserIds = [
    ...superAdmins,
    ...schoolAdmins,
    ...teachers,
    ...classAdmins,
    ...students,
    ...parents
  ]
    .map(row => row.id)
    .filter(Boolean)

  const uniqueIds = [...new Set(allUserIds)]

  // G2 — Exclude the homework sender from receiving their own notification
  if (normalizedSenderId) {
    return uniqueIds.filter(id => id !== normalizedSenderId)
  }

  return uniqueIds
}
