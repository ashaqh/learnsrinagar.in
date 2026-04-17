-- Reset all user passwords to 'password'
-- This sets all users' passwords to 'password' (bcrypt hashed)

UPDATE users 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

-- Verification query (optional - run this to check)
-- SELECT id, name, email, password_hash FROM users;