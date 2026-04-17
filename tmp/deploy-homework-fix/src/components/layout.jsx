import {
  redirect,
  Link,
  Outlet,
  useLoaderData,
  useLocation,
} from '@remix-run/react'
import {
  LayoutDashboard,
  Building2,
  LogOut,
  RadioTower,
  CalendarClock,
  GraduationCap,
  BookOpen,
  School,
  ShieldCheck,
  UserCog,
  UserPlus,
  UserCheck,
  User,
  FileText,
  Bell,
} from 'lucide-react'

import { getUser } from '@/lib/auth'
import NotificationBell from './NotificationBell'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export async function loader({ request }) {
  const user = await getUser(request)
  return user ? user : redirect('/login')
}

const ALL_LINKS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'School Admin', icon: ShieldCheck, url: '/school-admin' },
  { title: 'School', icon: School, url: '/school' },
  { title: 'Class', icon: Building2, url: '/class' },
  { title: 'Subject', icon: BookOpen, url: '/subject' },
  { title: 'Teacher', icon: GraduationCap, url: '/teacher' },
  { title: 'Live Class', icon: RadioTower, url: '/live-class' },
  { title: 'Manage Live Classes', icon: RadioTower, url: '/manage-live-classes' },
  { title: 'View Live Classes', icon: RadioTower, url: '/manage-live-classes' },
  { title: 'Live Classes', icon: RadioTower, url: '/student-live-classes' },
  { title: 'Class Admin', icon: UserCog, url: '/class-admin' },
  { title: 'Timetable', icon: CalendarClock, url: '/timetable' },
  { title: 'Attendance', icon: UserCheck, url: '/attendance' },
  { title: 'Feedback', icon: BookOpen, url: '/feedback' },
  { title: 'Homework', icon: GraduationCap, url: '/homework' },
  { title: 'Student', icon: UserPlus, url: '/student' },
  { title: 'Manage Blogs', icon: FileText, url: '/manage-blogs' },
  { title: 'Change Password', icon: UserCog, url: '/change-password' },
  // { title: 'Parent', icon: User, url: '/parent' },
  { title: 'Notifications', icon: Bell, url: '/notifications' },
  { title: 'Logout', icon: LogOut, url: '/logout' },
]

const ROLE_LINKS = {
  super_admin: [
    'Dashboard',
    'Notifications',
    'School Admin',
    'School',
    'Teacher',
    'Class',
    'Subject',
    'Manage Live Classes',
    'Timetable',
    'Feedback',
    'Manage Blogs',
    'Change Password',
  ],
  school_admin: ['Dashboard', 'Notifications', 'Class Admin', 'View Live Classes', 'Attendance', 'Timetable', 'Student', 'Parent', 'Homework', 'Change Password'],
  class_admin: ['Dashboard', 'Notifications', 'View Live Classes', 'Attendance', 'Timetable', 'Student', 'Parent', 'Change Password'],
  teacher: ['Dashboard', 'Notifications', 'Manage Live Classes', 'Timetable', 'Homework', 'Change Password'],
  student: ['Dashboard', 'Notifications', 'Live Classes', 'Attendance', 'Timetable', 'Homework', 'Change Password'],
  parent: ['Dashboard', 'Notifications', 'Attendance', 'Timetable', 'Homework', 'Feedback', 'Change Password'],
}

export default function Layout() {
  const user = useLoaderData()
  const location = useLocation()

  const role = user?.role_name
  const allowedTitles = ROLE_LINKS[role] || []

  const visibleLinks = ALL_LINKS.filter(
    (link) => allowedTitles.includes(link.title) || link.title === 'Logout' // Always show logout
  )

  const getLinkLabel = (link) => {
    if (role === 'teacher' && link.title === 'Manage Live Classes') {
      return 'Live Class'
    }

    return link.title
  }

  const isActivePath = (url) => location.pathname === url

  const formatPathName = (path) =>
    path
      .split('/')
      .pop()
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  return (
    <SidebarProvider>
      <Sidebar collapsible='icon'>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size='lg'
                className='group-data-[collapsible=icon]:p-0!'
              >
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                  <BookOpen className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>Learn Srinagar</span>
                  <span className='truncate text-xs'>
                    Transforming Education
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className='relative flex w-full min-w-0 flex-col p-2'>
          <SidebarMenu>
            {visibleLinks.map((item) => (
              <SidebarMenuItem key={item.title}>
                <Link to={item.url}>
                  <SidebarMenuButton
                    isActive={isActivePath(item.url)}
                    tooltip={getLinkLabel(item)}
                  >
                    {item.icon && <item.icon />}
                    <span>{getLinkLabel(item)}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size='lg'>
                <div className='relative flex shrink-0 overflow-hidden rounded-full h-8 w-8'>
                  <div className='flex h-full w-full items-center justify-center rounded-full dark:bg-gray-800 bg-gray-200 text-gray-700'>
                    {user?.name
                      ? user.name.charAt(0).toUpperCase() +
                        (user.name.indexOf(' ') > 0
                          ? user.name
                              .charAt(user.name.indexOf(' ') + 1)
                              .toUpperCase()
                          : '')
                      : ''}
                  </div>
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>
                    {user?.name || ''}
                  </span>
                  <span className='truncate text-xs'>{user?.email || ''}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12'>
          <div className='flex flex-1 items-center justify-between gap-2 px-4'>
            <div className='flex items-center gap-2'>
              <SidebarTrigger />
              <Separator orientation='vertical' className='mr-2 h-4' />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className='hidden md:block'>
                    <BreadcrumbLink>Learn Srinagar</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className='hidden md:block' />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      <Link to={location.pathname}>
                        {formatPathName(location.pathname)}
                      </Link>
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className='flex items-center gap-4'>
              <NotificationBell />
            </div>
          </div>
        </header>
        <div className='p-2 sm:p-4 pt-0'>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
