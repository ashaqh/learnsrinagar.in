import { json } from '@remix-run/node';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function loader() {
    try {
        // Test database connection
        const users = await query('SELECT id, name, email, password_hash FROM users WHERE email = ?', ['super_admin@gmail.com']);
        
        if (users.length === 0) {
            return json({ error: 'User not found' });
        }
        
        const user = users[0];
        const testPassword = 'password';
        const isValid = await bcrypt.compare(testPassword, user.password_hash);
        
        return json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                hash: user.password_hash
            },
            passwordTest: isValid,
            message: isValid ? 'Password is correct' : 'Password is incorrect'
        });
    } catch (error) {
        return json({ error: error.message });
    }
}

export default function TestDb() {
    return <div>Check the network tab for JSON response</div>;
}