import { useState, useEffect } from 'react'
import { json } from '@remix-run/node'
import { useLoaderData, useActionData, useNavigation, useFetcher } from '@remix-run/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bell, Send, CheckCircle, Clock, Users, Shield, GraduationCap, School } from 'lucide-react'
import { query } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { formatDistanceToNow } from 'date-fns'
import { getNotificationsForUser } from '@/services/notificationSchema.server'

export async function loader({ request }) {
  const user = await getUser(request)
  if (!user) throw new Response('Unauthorized', { status: 401 })

  const { notifications } = await getNotificationsForUser(user.id, 100)

  let adminData = {}
  if (user.role_name === 'super_admin') {
    const schools = await query('SELECT id, name FROM schools ORDER BY name')
    const classes = await query('SELECT id, name FROM classes ORDER BY name')
    adminData = { schools, classes }
  }

  return json({ notifications, user, ...adminData })
}

export async function action({ request }) {
  const user = await getUser(request)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Only super_admin can broadcast notifications
  if (user.role_name === 'school_admin') {
    return new Response(JSON.stringify({ success: false, error: 'School admins do not have permission to broadcast notifications' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'broadcast') {
    const title = formData.get('title')
    const message = formData.get('message')
    const targetType = formData.get('targetType') // all, role, group, user
    const targetId = formData.get('targetId')

    const { notificationService } = await import("@/services/notificationService.server")
    try {
      const result = await notificationService.sendNotification({
        title,
        message,
        targetType,
        targetId,
        senderId: user.id,
        eventType: 'MANUAL_BROADCAST'
      })

      if (result.success) {
        return new Response(JSON.stringify({ success: true, message: result.message || 'Broadcast sent successfully' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } else {
        return new Response(JSON.stringify({ success: false, error: result.message || 'Failed to send broadcast' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
       return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  return null
}

export default function NotificationsPage() {
  const { notifications: initialNotifications, user, schools, classes } = useLoaderData()
  const actionData = useActionData()
  const navigation = useNavigation()
  const fetcher = useFetcher()
  
  const [notifications, setNotifications] = useState(initialNotifications)
  const [targetType, setTargetType] = useState('all')
  const isBroadcasting = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'broadcast'

  const isAdmin = user.role_name === 'super_admin'

  const markRead = async (id = null) => {
    fetcher.submit(
      { action: 'mark-read', notificationId: id || '' },
      { method: 'PUT', action: '/api/notifications' }
    )
  }

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
       // Refresh list could be done via revalidation or local state
    }
  }, [fetcher.data])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Button variant="outline" onClick={() => markRead(null)}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      {isAdmin && (
        <Card className="border-blue-100 bg-blue-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Broadcast
            </CardTitle>
            <CardDescription>Send an announcement to all users or specific groups.</CardDescription>
          </CardHeader>
          <CardContent>
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="broadcast" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Announcement Title</Label>
                  <Input id="title" name="title" placeholder="e.g. School Holiday Notice" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetType">Target Audience</Label>
                  <Select name="targetType" value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone (All Users)</SelectItem>
                      <SelectItem value="role">By Role</SelectItem>
                      <SelectItem value="group">By Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {targetType === 'role' && (
                <div className="space-y-2">
                  <Label htmlFor="targetId">Select Role</Label>
                  <Select name="targetId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="teacher">Teachers</SelectItem>
                      <SelectItem value="parent">Parents</SelectItem>
                      <SelectItem value="school_admin">School Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {targetType === 'group' && (
                <div className="space-y-2">
                  <Label htmlFor="targetId">Select Class</Label>
                  <Select name="targetId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Message Content</Label>
                <Textarea id="message" name="message" placeholder="Type your broadcast message here..." rows={3} required />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isBroadcasting}>
                  {isBroadcasting ? 'Sending...' : 'Broadcast Now'}
                </Button>
              </div>
            </fetcher.Form>
            {fetcher.data?.success && (
              <p className="mt-2 text-sm text-green-600 font-medium">{fetcher.data.message}</p>
            )}
            {fetcher.data?.error && (
              <p className="mt-2 text-sm text-red-600 font-medium">{fetcher.data.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">Notification</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No notifications found.
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((notif) => (
                    <TableRow key={notif.id} className={!notif.is_read ? 'bg-blue-50/30' : ''}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{notif.title}</span>
                          <span className="text-sm text-gray-600">{notif.message}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {(notif.event_type || 'GENERAL').replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {!notif.is_read ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => markRead(notif.id)}
                          >
                            Mark as read
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">Read</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
