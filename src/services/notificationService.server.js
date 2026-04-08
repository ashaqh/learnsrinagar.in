import { query } from "@/lib/db";
import admin from 'firebase-admin';
import path from 'path';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
let firebaseApp;
try {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully');
  } else {
    firebaseApp = admin.app();
    console.log('Firebase Admin reused existing app');
  }
} catch (error) {
  console.error('Firebase Admin failed to initialize:', error.message);
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
    metadata = {},
    senderId = null
  }) {
    try {
      // 1. Record in master notifications table
      const res = await query(
        `INSERT INTO notifications (title, message, type, event_type, target_type, target_id, metadata, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, message, type, eventType, targetType, targetId, JSON.stringify(metadata), senderId]
      )
      const notificationId = res.insertId;

      // 2. Identify target users
      let userIds = [];
      if (targetType === 'all') {
        const users = await query('SELECT id FROM users');
        userIds = users.map(u => u.id);
      } else if (targetType === 'role') {
        const users = await query(
          'SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = ?',
          [targetId]
        );
        userIds = users.map(u => u.id);
      } else if (targetType === 'school') {
        const users = await query('SELECT id FROM users WHERE school_id = ?', [targetId]);
        userIds = users.map(u => u.id);
      } else if (targetType === 'class' || targetType === 'group') {
        const users = await query('SELECT id FROM users WHERE class_id = ?', [targetId]);
        userIds = users.map(u => u.id);
      } else if (targetType === 'user') {
        userIds = [targetId];
      }

      // 3. Create delivery tracking for each user
      if (userIds.length > 0) {
        console.log(`Targeting ${userIds.length} users for notification: ${title}`);
        const values = userIds.map(uid => `(${uid}, ${notificationId})`).join(',');
        await query(`INSERT INTO user_notifications (user_id, notification_id) VALUES ${values}`);

        // 4. Send Push Notifications (FCM)
        await this._sendPushNotifications(userIds, title, message, metadata);
        return { success: true, notificationId, message: `Notification sent to ${userIds.length} users` };
      }

      return { success: false, message: 'No active users found for the selected target' };
    } catch (error) {
      console.error('NotificationService Error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Internal method to handle FCM delivery
   */
  async _sendPushNotifications(userIds, title, message, data) {
    if (!firebaseApp) return;

    try {
      // Get tokens for these users
      console.log(`[NotificationService] Fetching tokens for ${userIds.length} users:`, userIds.slice(0, 10), userIds.length > 10 ? '...' : '');
      const allTokens = await query('SELECT count(*) as count FROM device_tokens');
      console.log(`[NotificationService] TOTAL tokens in DB: ${allTokens[0].count}`);
      
      const tokenRows = await query(
        `SELECT user_id, token FROM device_tokens WHERE user_id IN (?)`,
        [userIds]
      );
      console.log(`[NotificationService] Raw tokenRows count: ${tokenRows.length}`);
      if (tokenRows.length > 0) {
        console.log(`[NotificationService] First few token matches:`, tokenRows.slice(0, 3).map(r => `user:${r.user_id}`));
      }

      const tokens = tokenRows.map(r => r.token);
      console.log(`Sending to ${tokens.length} FCM tokens:`, tokens.map(t => t.substring(0, 10) + '...'));

      if (tokens.length === 0) return;

      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
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
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          click_action: 'FLUTTER_NOTIFICATION_CLICK' 
        }
      });
      
      console.log(`FCM send successful: ${response.successCount} sent, ${response.failureCount} failed`);
    } catch (error) {
      console.error('FCM Send Error:', error);
    }
  }
}

export const notificationService = new NotificationService();
