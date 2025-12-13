-- =============================================
-- Create Default Super Admin User
-- Run this in your Supabase SQL Editor AFTER creating a user account
-- =============================================

-- STEP 1: First, manually create a user in Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add User" > "Create new user"
-- 3. Email: admin@unexplainedarchive.com
-- 4. Password: [Your secure password]
-- 5. Email confirm: ON (if you want to skip email verification)
-- 6. Copy the User ID after creation

-- STEP 2: Replace 'YOUR_USER_ID_HERE' below with the actual UUID from step 1
-- Then run this script in SQL Editor:

DO $$
DECLARE
    admin_user_id UUID := '87b4f5f2-4ded-4f84-9017-722db2fdaf99'; -- Replace with actual user ID
BEGIN
    -- Update or insert profile with admin role
    INSERT INTO profiles (id, username, full_name, role, reputation, created_at, updated_at)
    VALUES (
        admin_user_id,
        'superadmin',
        'System Administrator',
        'admin',
        9999,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) 
    DO UPDATE SET
        role = 'admin',
        reputation = 9999,
        updated_at = NOW();

    -- Grant admin verified investigator status (optional)
    INSERT INTO investigators (user_id, credentials, specialization, verified, cases_solved, rating, created_at, updated_at)
    VALUES (
        admin_user_id,
        'System Administrator - Full Access',
        ARRAY['administration', 'moderation', 'all'],
        true,
        0,
        5.00,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        verified = true,
        credentials = 'System Administrator - Full Access',
        specialization = ARRAY['administration', 'moderation', 'all'];

    RAISE NOTICE 'Super admin created successfully!';
END $$;

-- =============================================
-- ALTERNATIVE: Quick Profile Update for Existing Users
-- If you already have a user account and just want to make it admin:
-- =============================================

-- Replace 'your-email@example.com' with your actual email:
-- UPDATE profiles 
-- SET role = 'admin', reputation = 9999 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- =============================================
-- Verify Admin Creation
-- =============================================
SELECT 
    p.id,
    p.username,
    p.full_name,
    p.role,
    p.reputation,
    au.email,
    i.verified as is_verified_investigator
FROM profiles p
JOIN auth.users au ON au.id = p.id
LEFT JOIN investigators i ON i.user_id = p.id
WHERE p.role = 'admin';
