-- ============================================
-- Verification Script - Run After Applying Fix
-- ============================================
-- This script verifies that the authentication fix is working correctly

-- 1. Check if the trigger is BEFORE INSERT (not AFTER)
SELECT
    tgname as trigger_name,
    CASE
        WHEN tgtype & 2 = 2 THEN 'BEFORE'
        WHEN tgtype & 4 = 4 THEN 'AFTER'
        ELSE 'INSTEAD OF'
    END as trigger_timing,
    CASE
        WHEN tgenabled = 'O' THEN 'ENABLED'
        ELSE 'DISABLED'
    END as status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_confirm';

-- Expected result: trigger_timing should be 'BEFORE', status should be 'ENABLED'

-- 2. Check all users' confirmation status
SELECT
    au.email,
    CASE
        WHEN au.email_confirmed_at IS NULL THEN '❌ NOT CONFIRMED'
        ELSE '✅ CONFIRMED'
    END as email_status,
    au.email_confirmed_at,
    bu.is_active,
    bu.role,
    au.created_at
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
ORDER BY au.created_at DESC;

-- Expected result: All users should show '✅ CONFIRMED'

-- 3. Check for orphaned records
SELECT
    'Orphaned billing_users (no auth record)' as issue_type,
    COUNT(*) as count
FROM billing_users bu
LEFT JOIN auth.users au ON bu.auth_user_id = au.id
WHERE au.id IS NULL

UNION ALL

SELECT
    'Auth users without billing record' as issue_type,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE bu.id IS NULL;

-- Expected result: Both counts should be 0

-- 4. Verify email provider settings (informational)
SELECT
    'Email confirmation should be disabled in Supabase Dashboard' as note,
    'Go to: Authentication → Providers → Email' as instruction,
    'Confirm email setting should be OFF' as expected_setting;

-- 5. Test query to simulate what happens on login
-- Replace 'test@example.com' with an actual user email to test
SELECT
    au.id,
    au.email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    au.confirmed_at IS NOT NULL as user_confirmed,
    bu.is_active as billing_active,
    CASE
        WHEN au.email_confirmed_at IS NULL THEN '❌ Will fail login with "Invalid login credentials"'
        WHEN bu.is_active = false THEN '❌ Will fail with "User account is inactive"'
        WHEN bu.id IS NULL THEN '❌ Will fail with "User not authorized for billing system"'
        ELSE '✅ Should be able to log in'
    END as login_status
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE au.email = 'test@example.com';  -- Replace with actual email to test

-- 6. Summary check
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'on_auth_user_created_confirm'
            AND tgtype & 2 = 2  -- BEFORE trigger
            AND tgenabled = 'O'  -- Enabled
        ) THEN '✅'
        ELSE '❌'
    END as trigger_status,
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM auth.users
            WHERE email_confirmed_at IS NULL
        ) THEN '✅'
        ELSE '❌'
    END as all_users_confirmed,
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM billing_users bu
            LEFT JOIN auth.users au ON bu.auth_user_id = au.id
            WHERE au.id IS NULL
        ) THEN '✅'
        ELSE '❌'
    END as no_orphaned_billing_users,
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM auth.users au
            LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
            WHERE bu.id IS NULL
        ) THEN '✅'
        ELSE '❌'
    END as no_orphaned_auth_users;

-- Expected result: All checks should show '✅'

-- If you see any '❌', run fix-auth.sql again
