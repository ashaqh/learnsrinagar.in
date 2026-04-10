import bcrypt from 'bcryptjs'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { Form, redirect, useActionData, useNavigation } from '@remix-run/react'

import { query } from '@/lib/db'
import { createSession, getUser } from '@/lib/auth'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export async function loader({ request }) {
  const user = await getUser(request)
  return user ? redirect('/dashboard') : null
}

export async function action({ request }) {
  try {
    const form = await request.formData()
    const email = form.get('email')
    const password = form.get('password')

    console.log(`[Login] Attempt for email: ${email}`);

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return { error: 'Invalid credentials' }
    }

    const user = users[0];
    let passwordHash = user.password_hash;

    // Match the mobile/API login behavior for legacy bcrypt variants.
    if (passwordHash.startsWith('$2b$')) {
      passwordHash = passwordHash.replace('$2b$', '$2a$');
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    
    if (!isValid) {
      return { error: 'Invalid credentials' }
    }

  const roles = await query(`SELECT name FROM roles WHERE id = ?`, [
    user.role_id,
  ])
  const role = roles?.[0]

  if (!role?.name) {
    return { error: 'Unable to resolve user role' }
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role_name: role.name,
    school_id: null,
    class_ids: [],
    student_ids: [],
    subject_ids: [],
  }

  if (role) {
    const roleName = role.name

    if (roleName === 'student') {
      const studentProfiles = await query(
        `SELECT class_id, schools_id as school_id FROM student_profiles WHERE user_id = ?`,
        [user.id]
      )

      if (studentProfiles?.length > 0) {
        sessionUser.class_ids = [studentProfiles[0].class_id]
        sessionUser.school_id = studentProfiles[0].school_id
      }
    } else if (roleName === 'teacher') {
      const teacherSubjects = await query(
        `SELECT subject_id FROM teacher_assignments WHERE teacher_id = ?`,
        [user.id]
      )

      if (teacherSubjects?.length > 0) {
        sessionUser.subject_ids = teacherSubjects.map((item) => item.subject_id)
      }

      const teacherClasses = await query(
        `SELECT DISTINCT c.id as class_id 
         FROM teacher_assignments ta
         JOIN subjects s ON ta.subject_id = s.id
         JOIN classes c ON s.class_id = c.id
         WHERE ta.teacher_id = ?`,
        [user.id]
      )

      if (teacherClasses?.length > 0) {
        sessionUser.class_ids = teacherClasses.map((item) => item.class_id)
      }
    } else if (roleName === 'parent') {
      const parentLinks = await query(
        `SELECT student_id FROM parent_student_links WHERE parent_id = ?`,
        [user.id]
      )

      if (parentLinks?.length > 0) {
        sessionUser.student_ids = parentLinks.map((link) => link.student_id)
      }
    } else if (roleName === 'class_admin') {
      const classAdmins = await query(
        `SELECT school_id, class_id FROM class_admins WHERE admin_id = ?`,
        [user.id]
      )

      if (classAdmins?.length > 0) {
        sessionUser.school_id = classAdmins[0].school_id
        sessionUser.class_ids = classAdmins.map((item) => item.class_id)
      }
    } else if (roleName === 'school_admin') {
      const schools = await query(
        `SELECT id as school_id FROM schools WHERE users_id = ? LIMIT 1`,
        [user.id]
      )

      if (schools?.length > 0) {
        sessionUser.school_id = schools[0].school_id
      }
    }
  }

    return await createSession(request, sessionUser)
  } catch (error) {
    return { error: 'Server error occurred' }
  }
}

export default function Login() {
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error)
    }
  }, [actionData])

  return (
    <div className='flex min-h-svh w-full items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm'>
        <Card>
          <CardHeader>
            <CardTitle className='text-2xl'>Login</CardTitle>
            <CardDescription>
              Enter your credentials below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form method='post'>
              <div className='flex flex-col gap-6'>
                <div className='grid gap-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    name='email'
                    type='email'
                    placeholder='yourname@example.com'
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='password'>Password</Label>
                  <Input
                    id='password'
                    name='password'
                    type='password'
                    placeholder='********'
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type='submit'
                  className='w-full'
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Login'}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
