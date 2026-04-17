import { getUser } from '@/lib/auth'
import { redirect } from '@remix-run/node'

export async function loader({ request }) {
  const user = await getUser(request)
  const role = user.role_name

  if (role == 'super_admin') {
    return redirect('/school-admin')
  } else if (role == 'school_admin') {
    return redirect('/class-admin')
  } else if (role == 'class_admin') {
    return redirect('/attendance')
  } else if (role == 'teacher') {
    return redirect('/timetable')
  } else if (role == 'student') {
    return redirect('/attendance')
  } else if (role == 'parent') {
    return redirect('/attendance')
  }
}

export default function Dashboard() {
  return null
}
