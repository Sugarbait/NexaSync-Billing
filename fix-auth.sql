-- ============================================
-- Supabase Authentication Fix Script
-- ============================================
-- This script will fix common authentication issues

-- STEP 1: Confirm all existing unconfirmed users
-- This will manually confirm all users who haven't been confirmed yet
UPDATE auth.users
SET
    email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- STEP 2: Recreate the auto-confirm trigger (improved version)
-- First, drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
DROP FUNCTION IF EXISTS auto_confirm_user();

-- Create an improved auto-confirm function
CREATE OR REPLACE FUNCTION auto_confirm_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-confirm the user immediately upon creation
    NEW.email_confirmed_at := NOW();
    NEW.confirmed_at := NOW();

    RETURN NEW;
END;
$$;

-- Create trigger that runs BEFORE INSERT to modify the record before it's created
CREATE TRIGGER on_auth_user_created_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_confirm_user();

-- STEP 3: Verify email provider settings
-- Check current email auth settings
SELECT
    id,
    CASE
        WHEN raw_app_meta_data->>'provider' = 'email' THEN 'Email provider'
        ELSE 'Other provider'
    END as auth_provider
FROM auth.users;

-- STEP 4: Fix any orphaned billing_users records
-- Delete billing users that don't have corresponding auth users
DELETE FROM billing_users
WHERE auth_user_id NOT IN (SELECT id FROM auth.users);

-- STEP 5: Sync auth.users with billing_users
-- This ensures all auth users have corresponding billing_users records
-- NOTE: You may need to adjust the role and created_by fields
INSERT INTO billing_users (auth_user_id, email, full_name, role, is_active, created_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    'admin', -- Default role
    true,
    au.created_at
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE bu.id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;

-- STEP 6: Verify the fix
-- This should return all users with confirmed emails
SELECT
    au.id,
    au.email,
    au.email_confirmed_at,
    au.confirmed_at,
    bu.id as billing_id,
    bu.is_active,
    bu.role
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
ORDER BY au.created_at DESC;
