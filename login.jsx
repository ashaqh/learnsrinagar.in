import bcrypt from 'bcryptjs';
import { json, redirect } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';

import { query } from '@/lib/db';

export async function action({ request }) {
  try {
    const form = await request.formData();
    const email = form.get('email');
    const password = form.get('password');

    console.log(`[Login] Attempt for email: ${email}`);

    const users = await query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!users || users.length === 0) {
      return json({ error: 'User not found' }, { status: 400 });
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return json({ error: 'Invalid password' }, { status: 400 });
    }

    console.log('[Login] SUCCESS');

    return redirect('/dashboard');
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return json({ error: 'Server error' }, { status: 500 });
  }
}

export default function Login() {
  const actionData = useActionData();

  return (
    <div>
      <h1>Login</h1>

      {actionData?.error && (
        <p style={{ color: 'red' }}>{actionData.error}</p>
      )}

      <Form method="post">
        <input name="email" placeholder="Email" />
        <input name="password" type="password" placeholder="Password" />
        <button type="submit">Login</button>
      </Form>
    </div>
  );
}
