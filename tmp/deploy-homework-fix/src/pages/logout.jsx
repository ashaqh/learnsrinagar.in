import { deleteSession } from '@/lib/auth'

export async function loader({ request }) {
  return await deleteSession(request)
}

export default function Logout() {
  return null
}
