import { json } from "@remix-run/node"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/auth"
import { formatLiveClassDateTimeForApi } from "@/lib/liveClassDateTime"

export async function loader({ request }) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const user = verifyToken(token)

  if (!user) {
    return json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const url = new URL(request.url)
  const classId = url.searchParams.get("classId")

  try {
    // Use live_classes table as the source for the timetable
    const timetable = await query(
      `SELECT z.id,
              IFNULL(s.name, z.topic_name) as subject_name,
              u.name as teacher_name,
              c.name as class_name,
              DAYNAME(z.start_time) as day_of_week,
              DATE(z.start_time) as class_date,
              z.start_time as raw_start_time,
              z.end_time as raw_end_time,
              TIME_FORMAT(z.start_time, '%H:%i:%s') as start_time,
              TIME_FORMAT(z.end_time, '%H:%i:%s') as end_time,
              z.zoom_link,
              z.youtube_live_link,
              z.session_type
       FROM live_classes z
       LEFT JOIN subjects s ON z.subject_id = s.id
       JOIN users u ON z.teacher_id = u.id
       JOIN classes c ON z.class_id = c.id
       WHERE (? IS NULL OR z.class_id = ?)
       ORDER BY z.start_time ASC`,
      [classId, classId]
    )

    return json({
      timetable: timetable.map((item) => ({
        ...item,
        raw_start_time: formatLiveClassDateTimeForApi(item.raw_start_time),
        raw_end_time: item.raw_end_time
          ? formatLiveClassDateTimeForApi(item.raw_end_time)
          : null,
      })),
    })
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 })
  }
}
