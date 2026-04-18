import { query, transaction } from '@/lib/db'
import admin from 'firebase-admin'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { getFirestore } from 'firebase-admin/firestore'

import {
  ensureNotificationSchema,
  resolveNotificationRecipientIds,
  getAllRelevantHomeworkRecipients,
} from '@/services/notificationSchema.server'

// Initialize Firebase Admin
let firebaseApp;
let db; // Firestore instance
const currentFileDir = path.dirname(fileURLToPath(import.meta.url))
const firebaseRuntimeStatus = {
  initialized: false,
  appName: null,
  serviceAccountPath: null,
  projectId: null,
  error: null,
}

function getFirebaseRuntimeStatus() {
  return { ...firebaseRuntimeStatus }
}

function getPushDeliveryStatus(pushDelivery = {}) {
  if (pushDelivery.error) return 'error'
  if (pushDelivery.skipped) return 'skipped'
  if (!pushDelivery.deliveryAttempted && pushDelivery.uniqueTokenCount === 0) return 'no_tokens'
  if (pushDelivery.failureCount > 0 && pushDelivery.successCount > 0) return 'partial'
  if (pushDelivery.failureCount > 0 && pushDelivery.successCount === 0) return 'failed'
  if (pushDelivery.successCount > 0) return 'sent'
  return 'unknown'
}

function buildPushWarning(pushDelivery = {}) {
  if (pushDelivery.error) {
    return `Push delivery encountered an error: ${pushDelivery.error}`
  }

  if (pushDelivery.skipped && pushDelivery.skipReason === 'firebase-admin-not-initialized') {
    const initError = pushDelivery.firebase?.error || 'unknown initialization error'
    return `Push delivery skipped because Firebase Admin is not initialized (${initError})`
  }

  if (pushDelivery.skipped && pushDelivery.skipReason === 'no-target-tokens') {
    return 'Push delivery skipped because no FCM tokens were found for the targeted users'
  }

  if (pushDelivery.failureCount > 0 && pushDelivery.successCount === 0) {
    return 'Push delivery failed for all targeted FCM tokens'
  }

  if (pushDelivery.failureCount > 0) {
    return `Push delivery partially failed (${pushDelivery.failureCount} failed, ${pushDelivery.successCount} succeeded)`
  }

  return null
}

function createBasePushDelivery(fields = {}) {
  return {
    attempted: false,
    deliveryAttempted: false,
    skipped: false,
    skipReason: null,
    error: null,
    targetUserCount: 0,
    totalTokensInDb: 0,
    matchedTokenCount: 0,
    uniqueTokenCount: 0,
    batchCount: 0,
    successCount: 0,
    failureCount: 0,
    staleTokensRemoved: 0,
    failureSamples: [],
    firebase: getFirebaseRuntimeStatus(),
    ...fields,
  }
}

function resolveServiceAccountPath() {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const candidatePaths = [
    configuredPath,
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(currentFileDir, '../../service-account.json'),
  ].filter(Boolean)

  const matchingPath = candidatePaths.find((candidatePath) => existsSync(candidatePath))
  if (!matchingPath) {
    throw new Error(
      'Firebase service account file not found. Set FIREBASE_SERVICE_ACCOUNT_PATH or add service-account.json to the project root.'
    )
  }

  return matchingPath
}

try {
  const APP_NAME = 'LEARN_SRINAGAR_ADMIN'
  const existingApp = admin.apps.find(app => app.name === APP_NAME)

  if (!existingApp) {
    const serviceAccountPath = resolveServiceAccountPath()
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    
    // Sanitize private key: Some environments escape newlines as \\n
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    }, APP_NAME)
    firebaseRuntimeStatus.initialized = true
    firebaseRuntimeStatus.appName = APP_NAME
    firebaseRuntimeStatus.serviceAccountPath = serviceAccountPath
    firebaseRuntimeStatus.projectId = serviceAccount.project_id ?? null
    firebaseRuntimeStatus.error = null
    console.log(`Firebase Admin [${APP_NAME}] initialized successfully`)
  } else {
    firebaseApp = existingApp
    firebaseRuntimeStatus.initialized = true
    firebaseRuntimeStatus.appName = APP_NAME
    firebaseRuntimeStatus.error = null
    console.log(`Firebase Admin [${APP_NAME}] reused existing instance`)
  }
  
  db = getFirestore(firebaseApp)
  console.log('Firestore initialized successfully')
} catch (error) {
  firebaseRuntimeStatus.initialized = false
  firebaseRuntimeStatus.error = error.message
  console.error('Firebase Admin failed to initialize:', error.message)
}

/**
 * NotificationService
 * Handles sending multi-channel notifications (Push, In-App).
 */
class NotificationService {
  /**
   * Send notification to a targeted audience
   * @param {Object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {string} options.type - 'system' or 'manual'
   * @param {string} options.eventType - e.g., 'CLASS_SCHEDULED'
   * @param {string} options.targetType - 'all', 'role', 'group', or 'user'
   * @param {string|number} options.targetId - Optional ID for role, group, or user
   * @param {Object} options.audienceContext - Optional recipient scoping metadata
   * @param {Object} options.metadata - Optional metadata (JSON)
   * @param {number} options.senderId - Optional user ID of the sender (admin)
   */
  async sendNotification({
    title,
    message,
    type = 'system',
    eventType = null,
    targetType = 'all',
    targetId = null,
    audienceContext = null,
    metadata = {},
    senderId = null
  }) {
    try {
      await ensureNotificationSchema()

      const userIds = await resolveNotificationRecipientIds(
        targetType,
        targetId,
        audienceContext ?? {}
      )

      if (userIds.length === 0) {
        return {
          success: false,
          message: 'No active users found for the selected target',
        }
      }

      console.log(`Targeting ${userIds.length} users for notification: ${title}`)

      let notificationId = null
      await transaction(async (tx) => {
        const insertResult = await tx(
          `
            INSERT INTO notifications (
              title,
              message,
              type,
              event_type,
              target_type,
              target_id,
              metadata,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            title,
            message,
            type,
            eventType,
            targetType,
            targetId,
            JSON.stringify(metadata ?? {}),
            senderId,
          ]
        )

        notificationId = insertResult.insertId

        const placeholders = userIds.map(() => '(?, ?, CURRENT_TIMESTAMP)').join(', ')
        const params = userIds.flatMap((userId) => [userId, notificationId])

        await tx(
          `
            INSERT INTO user_notifications (user_id, notification_id, delivered_at)
            VALUES ${placeholders}
          `,
          params
        )
      })

      const pushDelivery = await this._sendPushNotifications(userIds, title, message, metadata)
      const pushDeliveryStatus = getPushDeliveryStatus(pushDelivery)
      const warning = buildPushWarning(pushDelivery)

      if (warning) {
        console.warn(`[NotificationService] ${warning}`, {
          notificationId,
          title,
          recipientCount: userIds.length,
          pushDeliveryStatus,
          pushDelivery,
        })
      }

      return {
        success: true,
        notificationId,
        recipientCount: userIds.length,
        message: `Notification stored for ${userIds.length} users`,
        pushDeliveryStatus,
        pushDelivery,
        warning,
      }
    } catch (error) {
      console.error('NotificationService Error:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Internal method to store notifications in Firestore for real-time delivery
   */
  async _storeInFirestore(userIds, payload) {
    if (!db) {
      console.warn('[NotificationService] Firestore is not initialized. Skipping Firestore storage.')
      return
    }

    try {
      // Chunk userIds into batches of 500 for Firestore limits
      const chunkSize = 500
      for (let i = 0; i < userIds.length; i += chunkSize) {
        const batch = db.batch()
        const chunk = userIds.slice(i, i + chunkSize)
        
        chunk.forEach(userId => {
          const ref = db.collection('notifications').doc()
          batch.set(ref, {
            userId: Number(userId),
            mysqlId: payload.mysqlId || null,
            title: payload.title,
            message: payload.message,
            type: payload.type || 'system',
            eventType: payload.eventType,
            metadata: payload.metadata || {},
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          })
        })
        
        await batch.commit()
      }
      console.log(`[NotificationService] Stored notifications for ${userIds.length} users in Firestore`)
    } catch (error) {
      console.error('[NotificationService] Firestore Batch Write Error:', error)
    }
  }

  /**
   * Internal method to send notifications to FCM topics
   */
  async _sendToTopics(topics, payload) {
    if (!firebaseApp) {
      return {
        attempted: false,
        skipped: true,
        skipReason: 'firebase-admin-not-initialized',
        topicCount: topics.length,
        successCount: 0,
        failureCount: 0,
        failedTopics: [],
        firebase: getFirebaseRuntimeStatus(),
      }
    }

    try {
      const messaging = admin.messaging(firebaseApp)
      
      const promises = topics.map(topic => {
        return messaging.send({
          notification: {
            title: payload.title,
            body: payload.message,
          },
          data: {
            ...Object.fromEntries(
              Object.entries(payload.metadata ?? {}).map(([key, value]) => [key, String(value)])
            ),
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          topic: topic,
          android: {
            priority: 'high',
            notification: {
              channelId: 'high_importance_channel',
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          }
        })
      })

      const results = await Promise.allSettled(promises)
      let successCount = 0
      let failureCount = 0
      const failedTopics = []

      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          failureCount += 1
          failedTopics.push({
            topic: topics[idx],
            error: res.reason?.message || String(res.reason),
          })
          console.error(`[NotificationService] Failed to send to topic ${topics[idx]}:`, res.reason)
        } else {
          successCount += 1
          console.log(`[NotificationService] Successfully sent to topic ${topics[idx]}`)
        }
      })

      return {
        attempted: true,
        skipped: false,
        skipReason: null,
        topicCount: topics.length,
        successCount,
        failureCount,
        failedTopics,
        firebase: getFirebaseRuntimeStatus(),
      }
    } catch (error) {
      console.error('[NotificationService] FCM Topic Send Error:', error)
      return {
        attempted: true,
        skipped: false,
        skipReason: null,
        topicCount: topics.length,
        successCount: 0,
        failureCount: topics.length,
        failedTopics: topics.map(topic => ({ topic, error: error.message })),
        error: error.message,
        firebase: getFirebaseRuntimeStatus(),
      }
    }
  }

  /**
   * Specialized method for homework notifications to all relevant roles
   */
  async sendHomeworkNotification({ title, message, classId, schoolId, metadata, senderId }) {
    try {
      const userIds = await getAllRelevantHomeworkRecipients(classId, schoolId)
      
      if (userIds.length === 0) {
        console.log('[NotificationService] No recipients found for homework notification')
        return { success: false, message: 'No recipients found' }
      }

      console.log(`[NotificationService] Sending homework notification to ${userIds.length} users`)

      // 1. Store in MySQL (for persistence/history)
      const mysqlResult = await this.sendNotification({
        title,
        message,
        type: 'system',
        eventType: 'HOMEWORK_ASSIGNED',
        targetType: 'class',
        targetId: classId,
        metadata,
        senderId
      })

      if (!mysqlResult.success) {
        return mysqlResult
      }

      // 2. Store in Firestore (for real-time bell)
      await this._storeInFirestore(userIds, {
        mysqlId: mysqlResult.notificationId,
        title,
        message,
        type: 'homework',
        eventType: 'HOMEWORK_ASSIGNED',
        metadata
      })

      // 3. Send via FCM Topics
      const topics = [
        'super_admin',
        `school_${schoolId}`,
        `class_${classId}`,
        `teachers_${schoolId}`
      ]
      const topicDelivery = await this._sendToTopics(topics, { title, message, metadata })

      if (topicDelivery?.failureCount > 0 || topicDelivery?.skipped) {
        console.warn('[NotificationService] Homework topic delivery warning', {
          classId,
          schoolId,
          topicDelivery,
        })
      }

      return {
        success: true,
        notificationId: mysqlResult.notificationId,
        recipientCount: userIds.length,
        message: `Homework notification stored for ${userIds.length} users`,
        pushDeliveryStatus: mysqlResult.pushDeliveryStatus,
        pushDelivery: mysqlResult.pushDelivery,
        topicDelivery,
        warning: mysqlResult.warning ?? null,
      }
    } catch (error) {
      console.error('[NotificationService] sendHomeworkNotification Error:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Sync Firestore read status with MySQL
   */
  async markFirestoreRead(userId, notificationId = null) {
    if (!db) return

    try {
      const collectionRef = db.collection('notifications')
      let queryRef = collectionRef.where('userId', '==', Number(userId)).where('isRead', '==', false)

      if (notificationId) {
        queryRef = queryRef.where('mysqlId', '==', Number(notificationId))
      }

      const snapshot = await queryRef.get()
      if (snapshot.empty) return

      const batch = db.batch()
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true, readAt: admin.firestore.FieldValue.serverTimestamp() })
      })

      await batch.commit()
      console.log(`[NotificationService] Marked ${snapshot.size} notifications as read in Firestore for user ${userId}`)
    } catch (error) {
      console.error('[NotificationService] Firestore Mark Read Error:', error)
    }
  }

  /**
   * Internal method to handle FCM delivery
   */
  async _sendPushNotifications(userIds, title, message, data) {
    if (!firebaseApp) {
      const skippedSummary = createBasePushDelivery({
        skipped: true,
        skipReason: 'firebase-admin-not-initialized',
        targetUserCount: userIds.length,
      })
      console.warn('[NotificationService] Firebase Admin is not initialized. Push delivery skipped.', skippedSummary)
      return skippedSummary
    }

    try {
      await ensureNotificationSchema()

      // Get tokens for these users
      console.log(`[NotificationService] Fetching tokens for ${userIds.length} users:`, userIds.slice(0, 10), userIds.length > 10 ? '...' : '')
      const allTokens = await query('SELECT count(*) as count FROM device_tokens')
      console.log(`[NotificationService] TOTAL tokens in DB: ${allTokens[0].count}`)
      const summary = createBasePushDelivery({
        attempted: true,
        targetUserCount: userIds.length,
        totalTokensInDb: Number(allTokens[0]?.count ?? 0),
      })
      
      const tokenRows = await query(
        `SELECT id, user_id, token FROM device_tokens WHERE user_id IN (?)`,
        [userIds]
      )
      console.log(`[NotificationService] Raw tokenRows count: ${tokenRows.length}`)
      summary.matchedTokenCount = tokenRows.length
      if (tokenRows.length > 0) {
        console.log(`[NotificationService] First few token matches:`, tokenRows.slice(0, 3).map(r => `user:${r.user_id}`))
      }

      const uniqueTokenRows = [...new Map(
        tokenRows
          .filter((row) => row.token)
          .map((row) => [row.token, row])
      ).values()]
      const invalidTokenIds = new Set()
      const batches = []

      for (let start = 0; start < uniqueTokenRows.length; start += 500) {
        batches.push(uniqueTokenRows.slice(start, start + 500))
      }
      summary.uniqueTokenCount = uniqueTokenRows.length
      summary.batchCount = batches.length

      console.log(
        `Sending to ${uniqueTokenRows.length} FCM tokens in ${batches.length} batch(es):`,
        uniqueTokenRows.map((row) => row.token.substring(0, 10) + '...')
      )

      if (uniqueTokenRows.length === 0) {
        console.log('[NotificationService] No FCM tokens found for targeted users.')
        summary.skipped = true
        summary.skipReason = 'no-target-tokens'
        return summary
      }

      summary.deliveryAttempted = true

      for (const batch of batches) {
        const response = await admin.messaging(firebaseApp).sendEachForMulticast({
          tokens: batch.map((row) => row.token),
          notification: { title, body: message },
          android: {
            priority: 'high',
            notification: {
              channelId: 'high_importance_channel',
              sound: 'default',
              priority: 'high',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          },
          data: {
            ...Object.fromEntries(
              Object.entries(data ?? {}).map(([key, value]) => [key, String(value)])
            ),
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          }
        })

        summary.successCount += response.successCount
        summary.failureCount += response.failureCount

        response.responses.forEach((result, index) => {
          if (result.success) return

          const failedTokenRow = batch[index]
          const error = result.error
          console.error(
            `[NotificationService] Failed FCM delivery for user ${failedTokenRow.user_id}:`,
            {
              code: error?.code,
              message: error?.message,
              stack: error?.stack
            }
          )

          if (summary.failureSamples.length < 20) {
            summary.failureSamples.push({
              userId: failedTokenRow.user_id,
              tokenId: failedTokenRow.id,
              code: error?.code || null,
              message: error?.message || 'Unknown FCM error',
            })
          }

          const errorCode = error?.code

          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokenIds.add(failedTokenRow.id)
          }
        })
      }

      if (invalidTokenIds.size > 0) {
        const staleTokenIds = [...invalidTokenIds]
        await query('DELETE FROM device_tokens WHERE id IN (?)', [staleTokenIds])
        summary.staleTokensRemoved = staleTokenIds.length
        console.log(
          `[NotificationService] Removed ${staleTokenIds.length} invalid FCM token(s) from device_tokens.`
        )
      }

      console.log('[NotificationService] FCM multicast summary:', summary)
      console.log(`FCM send successful: ${summary.successCount} sent, ${summary.failureCount} failed`)
      return summary
    } catch (error) {
      console.error('FCM Send Error:', error)
      return createBasePushDelivery({
        attempted: true,
        targetUserCount: userIds.length,
        error: error.message,
      })
    }
  }
}

export const notificationService = new NotificationService()
export { getFirebaseRuntimeStatus }
