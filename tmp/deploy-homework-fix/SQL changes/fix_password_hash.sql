-- Fix password hash format for bcryptjs compatibility
-- This sets all users' passwords to 'password' with correct $2a$ format

UPDATE users 
SET password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

-- Verification query
SELECT id, name, email, password_hash FROM users LIMIT 5;