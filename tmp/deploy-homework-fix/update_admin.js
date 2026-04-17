import bcrypt from 'bcryptjs';
import { query } from './src/lib/db.js';

async function updateSuperAdmin() {
    // Change these values
    const newName = 'Your Admin Name';
    const newEmail = 'your-email@example.com';
    const newPassword = 'your-secure-password';
    
    try {
        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        // Update the super admin
        await query(
            `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE role_id = 1`,
            [newName, newEmail, passwordHash]
        );
        
        console.log('✅ Super admin credentials updated successfully!');
        console.log(`New email: ${newEmail}`);
        console.log(`New password: ${newPassword}`);
        
    } catch (error) {
        console.error('❌ Error updating admin:', error);
    }
    
    process.exit(0);
}

updateSuperAdmin();