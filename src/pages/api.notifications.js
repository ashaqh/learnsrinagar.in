import { json } from "@remix-run/node";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function authorize(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}

export async function loader({ request }) {
  const user = await authorize(request);
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const notifications = await query(`
      SELECT n.*, un.is_read, un.delivered_at, un.read_at
      FROM notifications n
      JOIN user_notifications un ON n.id = un.notification_id
      WHERE un.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [user.id]);

    return json({ success: true, notifications });
  } catch (error) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function action({ request }) {
  console.log(`[Notifications API] Request: ${request.method} ${request.url}`);
  const user = await authorize(request);
  if (!user) {
    console.log(`[Notifications API] Unauthorized request from ${request.headers.get("User-Agent")}`);
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const method = request.method;
  const data = await request.json();
  console.log(`[Notifications API] Action: ${data.action} for user ${user.id}`);

  try {
    // 1. Sync FCM Token
    if (method === 'POST' && data.action === 'sync-token') {
      const { fcmToken, deviceType = 'android' } = data;
      if (!fcmToken) return json({ success: false, message: 'Token required' }, { status: 400 });

      console.log(`[FCM] sync-token for user ${user.id}, token: ${fcmToken.substring(0, 20)}...`);
      
      const syncResult = await query(
        `INSERT INTO device_tokens (user_id, token, device_type) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), device_type = VALUES(device_type), last_updated = CURRENT_TIMESTAMP`,
        [user.id, fcmToken, deviceType]
      );
      console.log(`[FCM] token saved for user ${user.id}, affectedRows: ${syncResult.affectedRows}`);
      return json({ success: true, message: 'Token synced' });
    }

    // 2. Mark as Read
    if (method === 'PUT' && data.action === 'mark-read') {
      const { notificationId } = data;
      if (notificationId) {
        await query(
          'UPDATE user_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND notification_id = ?',
          [user.id, notificationId]
        );
      } else {
        // Mark all as read
        await query(
          'UPDATE user_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0',
          [user.id]
        );
      }
      return json({ success: true, message: 'Marked as read' });
    }

    // 3. Manual Notification (Admin Only)
    if (method === 'POST' && data.action === 'send-manual') {
      const isAdmin = user.role_name === 'super_admin' || user.role_name === 'school_admin';
      if (!isAdmin) return json({ success: false, message: 'Forbidden' }, { status: 403 });

      const { notificationService } = await import("@/services/notificationService.server");
      
      // If school_admin, force target school to their own if not specified or override
      const notificationData = { ...data };
      if (user.role_name === 'school_admin') {
        notificationData.targetType = 'school';
        notificationData.targetId = user.school_id;
      }

      const result = await notificationService.sendNotification({
        ...notificationData,
        type: 'manual',
        senderId: user.id
      });
      return json(result);
    }


    // 4. Delete Notification (Admin Only)
    if (method === 'DELETE' && data.action === 'delete') {
      const isAdmin = user.role_name === 'super_admin' || user.role_name === 'school_admin';
      if (!isAdmin) return json({ success: false, message: 'Forbidden' }, { status: 403 });
      
      const { notificationId } = data;
      if (!notificationId) return json({ success: false, message: 'Notification ID required' }, { status: 400 });

      // If school_admin, ensure they only delete their own
      if (user.role_name === 'school_admin') {
         await query('DELETE FROM notifications WHERE id = ? AND sender_id = ?', [notificationId, user.id]);
      } else {
         await query('DELETE FROM notifications WHERE id = ?', [notificationId]);
      }
      return json({ success: true, message: 'Notification deleted' });
    }

    return json({ success: false, message: 'Action not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Notifications API Error:', error);
    return json({ success: false, message: error.message }, { status: 500 });
  }
}
