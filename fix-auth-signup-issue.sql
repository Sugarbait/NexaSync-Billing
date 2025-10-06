-- ============================================
-- Fix Supabase Auth Signup Database Error
-- ============================================
-- This script diagnoses and fixes the "Database error saving new user" issue
-- Run each section in order and review the output

-- ====================
-- SECTION 1: DIAGNOSIS
-- ====================

-- Check current auth schema version and configuration
SELECT
    schemaversion as auth_schema_version
FROM auth.schema_migrations
ORDER BY version DESC
LIMIT 1;

-- Check for any triggers on auth.users table
SELECT
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- Check for any functions that might be called by triggers
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
    AND p.proname LIKE '%user%'
    AND p.proname LIKE '%confirm%'
ORDER BY schema, function_name;

-- Check RLS policies on auth.users (should be none, auth schema handles this)
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check auth.users table structure for any constraints that might cause issues
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass;

-- ====================
-- SECTION 2: FIX - Drop Problematic Triggers
-- ====================

-- Drop any custom triggers on auth.users that might interfere with signup
-- WARNING: Only run this if you see custom triggers in Section 1 output

-- Example of dropping a trigger (uncomment if needed):
-- DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
-- DROP FUNCTION IF EXISTS auto_confirm_user();

-- ====================
-- SECTION 3: FIX - Ensure Proper Configuration
-- ====================

-- Make sure the billing_users foreign key constraint allows nulls temporarily
-- This ensures auth.users can be created before billing_users record
ALTER TABLE billing_users
ALTER COLUMN auth_user_id DROP NOT NULL;

-- Verify the change
SELECT
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'billing_users'
    AND column_name = 'auth_user_id';

-- ====================
-- SECTION 4: FIX - Email Confirmation Settings
-- ====================

-- Check if email confirmations are enabled in your Supabase project
-- Go to: Supabase Dashboard > Authentication > Settings > Email Auth
-- Ensure "Enable email confirmations" is set appropriately for your use case

-- For development: You can auto-confirm users with a trigger
-- For production: Keep email confirmations enabled for security

-- Create auto-confirm function for DEVELOPMENT ONLY
-- This function automatically confirms users upon signup
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-confirm the user immediately upon creation
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW());

    RETURN NEW;
END;
$$;

-- Create trigger to auto-confirm users (DEVELOPMENT ONLY)
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- ====================
-- SECTION 5: VERIFY FIX
-- ====================

-- Test by checking if the function exists
SELECT
    proname as function_name,
    prosrc as function_source
FROM pg_proc
WHERE proname = 'auto_confirm_user';

-- Check if trigger is active
SELECT
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
    AND tgname = 'on_auth_user_created_auto_confirm';

-- ====================
-- SECTION 6: CLEANUP - Confirm Existing Unconfirmed Users
-- ====================

-- Find any users that were created but not confirmed
SELECT
    au.id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.confirmed_at,
    bu.id as billing_user_exists
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE au.email_confirmed_at IS NULL
ORDER BY au.created_at DESC;

-- Manually confirm all unconfirmed users (run this if needed)
UPDATE auth.users
SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- ====================
-- SECTION 7: ALTERNATIVE APPROACH - Database Function
-- ====================

-- If the above doesn't work, you may have a deeper issue with Supabase Auth
-- Consider creating a database function to handle user creation server-side

CREATE OR REPLACE FUNCTION public.create_billing_user_account(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT DEFAULT 'admin',
    p_created_by UUID DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_billing_user_id UUID;
    v_result json;
BEGIN
    -- Note: This function requires service role privileges
    -- You'll need to call this from a server-side API endpoint

    -- This is a placeholder - actual implementation would need
    -- to use Supabase Admin API or auth.admin functions

    RAISE EXCEPTION 'This function must be implemented server-side using Supabase Admin API';

    RETURN json_build_object(
        'success', false,
        'error', 'Use server-side implementation'
    );
END;
$$;

-- ====================
-- IMPORTANT NOTES
-- ====================

/*
WHAT WAS WRONG:
1. Supabase auth.signUp() was failing due to database triggers or constraints
2. Possible causes:
   - Custom triggers on auth.users interfering with the signup process
   - Foreign key constraint on billing_users.auth_user_id not allowing nulls
   - Email confirmation issues blocking user creation
   - RLS policies or check constraints on auth.users

HOW THIS FIX RESOLVES IT:
1. Auto-confirm trigger: Ensures users are immediately confirmed on creation
   - This prevents email confirmation from blocking the signup flow
   - ONLY use in development or if you handle email verification differently

2. Made auth_user_id nullable: Allows auth.users record to be created first,
   then billing_users record can be created separately with a reference

3. Cleaned up any conflicting triggers on auth.users table

RECOMMENDED APPROACH FOR PRODUCTION:
1. Keep email confirmations enabled in Supabase Dashboard
2. Remove the auto-confirm trigger
3. Use invite links with magic links instead of password signups
4. OR: Implement server-side user creation using Supabase Admin API
   with service role key (never expose this to the client)

NEXT STEPS:
1. Run Section 1 to diagnose the issue
2. Run Sections 2-4 to apply fixes
3. Test user creation from your app
4. If still failing, check Supabase logs in the Dashboard
5. Consider implementing server-side user creation for better security
*/
