import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { useActionData, useSubmit, useLoaderData } from '@remix-run/react'
import { toast } from 'sonner'
import { getUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { KeyRound, Shield, Eye, EyeOff } from 'lucide-react'

export async function loader({ request }) {
  const user = await getUser(request)
  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return { user }
}

export async function action({ request }) {
  const user = await getUser(request)
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  try {
    const formData = await request.formData()
    const currentPassword = formData.get('currentPassword')
    const newPassword = formData.get('newPassword')
    const confirmPassword = formData.get('confirmPassword')

    if (newPassword !== confirmPassword) {
      return { success: false, message: 'New passwords do not match' }
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' }
    }

    // Verify current password
    const users = await query('SELECT password_hash FROM users WHERE id = ?', [user.id])
    if (users.length === 0) {
      return { success: false, message: 'User not found' }
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, users[0].password_hash)
    if (!isCurrentValid) {
      return { success: false, message: 'Current password is incorrect' }
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(newPassword, salt)

    // Update password
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, user.id])

    return { success: true, message: 'Password changed successfully' }
  } catch (error) {
    return { success: false, message: 'An error occurred while changing password' }
  }
}

export default function ChangePassword() {
  const { user } = useLoaderData()
  const actionData = useActionData()
  const submit = useSubmit()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        toast.success(actionData.message)
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(actionData.message)
      }
    }
  }, [actionData])

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    submit(fd, { method: 'post' })
  }

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  return (
    <div className='container mx-auto px-4 pb-10 max-w-2xl'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold flex items-center gap-2'>
          <KeyRound className='h-6 w-6' />
          Change Password
        </h1>
        <p className='text-muted-foreground mt-1'>
          Update your password to keep your account secure
        </p>
      </div>

      <Card className='shadow-lg'>
        <CardHeader className='pb-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-primary/10 rounded-lg'>
              <Shield className='h-5 w-5 text-primary' />
            </div>
            <div>
              <CardTitle className='text-lg'>Security Settings</CardTitle>
              <CardDescription>
                Change password for {user?.name} ({user?.email})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <form onSubmit={handleSubmit} className='space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor='currentPassword' className='text-sm font-medium'>
                Current Password
              </Label>
              <div className='relative'>
                <Input
                  id='currentPassword'
                  name='currentPassword'
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className='pr-10'
                  placeholder='Enter your current password'
                  required
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => togglePasswordVisibility('current')}
                >
                  {showPasswords.current ? (
                    <EyeOff className='h-4 w-4 text-muted-foreground' />
                  ) : (
                    <Eye className='h-4 w-4 text-muted-foreground' />
                  )}
                </Button>
              </div>
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='newPassword' className='text-sm font-medium'>
                New Password
              </Label>
              <div className='relative'>
                <Input
                  id='newPassword'
                  name='newPassword'
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleChange}
                  className='pr-10'
                  placeholder='Enter your new password'
                  minLength={6}
                  required
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => togglePasswordVisibility('new')}
                >
                  {showPasswords.new ? (
                    <EyeOff className='h-4 w-4 text-muted-foreground' />
                  ) : (
                    <Eye className='h-4 w-4 text-muted-foreground' />
                  )}
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Password must be at least 6 characters long
              </p>
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor='confirmPassword' className='text-sm font-medium'>
                Confirm New Password
              </Label>
              <div className='relative'>
                <Input
                  id='confirmPassword'
                  name='confirmPassword'
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className='pr-10'
                  placeholder='Confirm your new password'
                  minLength={6}
                  required
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => togglePasswordVisibility('confirm')}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className='h-4 w-4 text-muted-foreground' />
                  ) : (
                    <Eye className='h-4 w-4 text-muted-foreground' />
                  )}
                </Button>
              </div>
            </div>
            
            <div className='pt-4'>
              <Button type='submit' className='w-full h-11 text-base font-medium'>
                <KeyRound className='mr-2 h-4 w-4' />
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className='mt-6 p-4 bg-muted/50 rounded-lg border'>
        <h3 className='font-medium text-sm mb-2'>Password Security Tips:</h3>
        <ul className='text-xs text-muted-foreground space-y-1'>
          <li>• Use a combination of letters, numbers, and special characters</li>
          <li>• Make it at least 8 characters long for better security</li>
          <li>• Avoid using personal information or common words</li>
          <li>• Don't reuse passwords from other accounts</li>
        </ul>
      </div>
    </div>
  )
}