const fs = require('fs')
const path = require('path')

try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
} catch (_) {}

async function main() {
  const admin = require('firebase-admin')
  const mysql = require('mysql2/promise')

  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json')
  const raw = fs.readFileSync(serviceAccountPath, 'utf8')
  const serviceAccount = JSON.parse(raw)

  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }

  const summary = {
    serviceAccount: {
      project_id: serviceAccount.project_id,
      private_key_id: serviceAccount.private_key_id,
      client_email: serviceAccount.client_email,
    },
    accessToken: null,
    db: null,
    sendAttempt: null,
  }

  const app = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    },
    'diag'
  )

  try {
    const token = await app.options.credential.getAccessToken()
    summary.accessToken = {
      ok: true,
      accessTokenPrefix: String(token.access_token || '').slice(0, 20),
      expiresIn: token.expires_in || null,
    }
  } catch (error) {
    summary.accessToken = {
      ok: false,
      code: error.code || null,
      message: error.message,
    }
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
  })

  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, token, device_type, last_updated FROM device_tokens ORDER BY last_updated DESC LIMIT 3'
    )
    summary.db = {
      ok: true,
      tokenCountSampled: rows.length,
      sample: rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        device_type: row.device_type,
        tokenPrefix: String(row.token || '').slice(0, 30),
        last_updated: row.last_updated,
      })),
    }

    if (rows[0]?.token) {
      try {
        const response = await admin.messaging(app).send({
          token: rows[0].token,
          notification: {
            title: 'FCM diagnostic',
            body: 'Testing production Firebase credential',
          },
          android: {
            priority: 'high',
          },
          data: {
            diagnostic: 'true',
            source: 'tmp_firebase_diag.cjs',
          },
        })

        summary.sendAttempt = {
          ok: true,
          messageId: response,
          testedUserId: rows[0].user_id,
          testedTokenPrefix: String(rows[0].token).slice(0, 30),
        }
      } catch (error) {
        summary.sendAttempt = {
          ok: false,
          testedUserId: rows[0].user_id,
          testedTokenPrefix: String(rows[0].token).slice(0, 30),
          code: error.code || null,
          message: error.message,
          errorInfo: error.errorInfo || null,
          stackTop: String(error.stack || '').split('\n').slice(0, 5),
        }
      }
    }
  } catch (error) {
    summary.db = {
      ok: false,
      code: error.code || null,
      message: error.message,
    }
  } finally {
    await pool.end()
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ fatal: true, message: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})