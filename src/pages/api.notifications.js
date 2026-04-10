import { json } from "@remix-run/node";
import { query } from "@/lib/db";
import { getUser, verifyToken } from "@/lib/auth";
import {
  ensureNotificationSchema,
  getNotificationsForUser,
  markNotificationsRead,
} from "@/services/notificationSchema.server";

async function authorize(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return verifyToken(token);
  }

  return getUser(request);
}

async function parseRequestData(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData);
}

export async function loader({ request }) {
  const user = await authorize(request);
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const { notifications, unreadCount } = await getNotificationsForUser(user.id, 50);

    return json({ success: true, notifications, unreadCount });
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
  const data = method === 'GET' || method === 'HEAD'
    ? {}
    : await parseRequestData(request);
  console.log(`[Notifications API] Action: ${data.action} for user ${user.id}`);

  try {
    // 1. Sync FCM Token
    if (method === 'POST' && data.action === 'sync-token') {
      await ensureNotificationSchema();

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
      await markNotificationsRead(user.id, notificationId);
      return json({ success: true, message: 'Marked as read' });
    }

    // 3. Manual Notification (Super Admin Only)
    if (method === 'POST' && data.action === 'send-manual') {
      const isSuperAdmin = user.role_name === 'super_admin';
      if (!isSuperAdmin) return json({ success: false, message: 'Forbidden' }, { status: 403 });

      const { notificationService } = await import("@/services/notificationService.server");

      const result = await notificationService.sendNotification({
        ...data,
        type: 'manual',
        senderId: user.id
      });
      return json(result);
    }


    // 4. Delete Notification (Admin Only)
    if (method === 'DELETE' && data.action === 'delete') {
      const isAdmin = user.role_name === 'super_admin' || user.role_name === 'school_admin';
      if (!isAdmin) return json({ success: false, message: 'Forbidden' }, { status: 403 });
      await ensureNotificationSchema();
      
      const { notificationId } = data;
      if (!notificationId) return json({ success: false, message: 'Notification ID required' }, { status: 400 });

      // If school_admin, ensure they only delete their own
      if (user.role_name === 'school_admin') {
         await query('DELETE FROM notifications WHERE id = ? AND created_by = ?', [notificationId, user.id]);
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
