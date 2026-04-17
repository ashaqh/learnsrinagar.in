-- Update Super Admin Credentials
-- Replace 'your-new-email@example.com' and 'your-new-password' with your desired credentials

UPDATE users 
SET 
    name = 'Your New Admin Name',
    email = 'your-new-email@example.com',
    password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'  -- This is 'password'
WHERE role_id = 1 AND email = 'super_admin@gmail.com';

-- To generate a new password hash, you can use bcrypt online tools or run this in Node.js:
-- const bcrypt = require('bcryptjs');
-- console.log(bcrypt.hashSync('your-new-password', 10));