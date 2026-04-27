import { json } from "@remix-run/node";
import { getUser, verifyToken } from "@/lib/auth";
import { getNotificationHealthSnapshot } from "@/services/notificationService.server";

async function authorize(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return verifyToken(token);
  }

  return getUser(request);
}

export async function loader({ request }) {
  const user = await authorize(request);
  if (!user) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (user.role_name !== 'super_admin') {
    return json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const health = await getNotificationHealthSnapshot();
    return json({ success: true, health });
  } catch (error) {
    console.error('[NotificationHealth] Failed to build notification health snapshot:', error);
    return json({ success: false, message: error.message }, { status: 500 });
  }
}
