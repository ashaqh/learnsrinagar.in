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
  if (admin.apps.length === 0) {
    const serviceAccountPath = resolveServiceAccountPath()
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
    console.log('Firebase Admin initialized successfully')
  } else {
    firebaseApp = admin.app()
    console.log('Firebase Admin reused existing app')
  }
  
  db = getFirestore(firebaseApp)
  console.log('Firestore initialized successfully')
} catch (error) {
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

      await this._sendPushNotifications(userIds, title, message, metadata)

      return {
        success: true,
        notificationId,
        message: `Notification sent to ${userIds.length} users`,
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
    if (!firebaseApp) return

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
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          console.error(`[NotificationService] Failed to send to topic ${topics[idx]}:`, res.reason)
        } else {
          console.log(`[NotificationService] Successfully sent to topic ${topics[idx]}`)
        }
      })
    } catch (error) {
      console.error('[NotificationService] FCM Topic Send Error:', error)
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
      await this._sendToTopics(topics, { title, message, metadata })

      return {
        success: true,
        notificationId: mysqlResult.notificationId,
        message: `Homework notification sent to topics and ${userIds.length} users`
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
      console.warn('[NotificationService] Firebase Admin is not initialized. Push delivery skipped.')
      return
    }

    try {
      await ensureNotificationSchema()

      // Get tokens for these users
      console.log(`[NotificationService] Fetching tokens for ${userIds.length} users:`, userIds.slice(0, 10), userIds.length > 10 ? '...' : '')
      const allTokens = await query('SELECT count(*) as count FROM device_tokens')
      console.log(`[NotificationService] TOTAL tokens in DB: ${allTokens[0].count}`)
      
      const tokenRows = await query(
        `SELECT id, user_id, token FROM device_tokens WHERE user_id IN (?)`,
        [userIds]
      )
      console.log(`[NotificationService] Raw tokenRows count: ${tokenRows.length}`)
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

      console.log(
        `Sending to ${uniqueTokenRows.length} FCM tokens in ${batches.length} batch(es):`,
        uniqueTokenRows.map((row) => row.token.substring(0, 10) + '...')
      )

      if (uniqueTokenRows.length === 0) {
        console.log('[NotificationService] No FCM tokens found for targeted users.')
        return
      }

      let successCount = 0
      let failureCount = 0

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

        successCount += response.successCount
        failureCount += response.failureCount

        response.responses.forEach((result, index) => {
          if (result.success) return

          const failedTokenRow = batch[index]
          const errorCode = result.error?.code
          console.error(
            `[NotificationService] Failed FCM delivery for user ${failedTokenRow.user_id}: ${errorCode ?? result.error?.message ?? 'Unknown error'}`
          )

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
        console.log(
          `[NotificationService] Removed ${staleTokenIds.length} invalid FCM token(s) from device_tokens.`
        )
      }

      console.log(`FCM send successful: ${successCount} sent, ${failureCount} failed`)
    } catch (error) {
      console.error('FCM Send Error:', error)
    }
  }
}

export const notificationService = new NotificationService()
