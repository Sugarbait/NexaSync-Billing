-- ============================================
-- Supabase Authentication Diagnostic Script
-- ============================================
-- Run this script in Supabase SQL Editor to diagnose authentication issues

-- 1. Check all users in auth.users table
SELECT
    id,
    email,
    email_confirmed_at,
    confirmed_at,
    created_at,
    raw_user_meta_data,
    encrypted_password IS NOT NULL as has_password
FROM auth.users
ORDER BY created_at DESC;

-- 2. Check billing_users table
SELECT
    id,
    auth_user_id,
    email,
    full_name,
    role,
    is_active,
    mfa_enabled,
    created_at
FROM billing_users
ORDER BY created_at DESC;

-- 3. Find users with mismatched auth/billing records
SELECT
    au.id as auth_id,
    au.email as auth_email,
    au.email_confirmed_at,
    bu.id as billing_id,
    bu.email as billing_email,
    bu.is_active
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE au.email_confirmed_at IS NULL OR bu.id IS NULL;

-- 4. Check for orphaned billing users (no auth record)
SELECT
    bu.id,
    bu.email,
    bu.auth_user_id,
    bu.is_active
FROM billing_users bu
LEFT JOIN auth.users au ON bu.auth_user_id = au.id
WHERE au.id IS NULL;

-- 5. Verify the auto-confirm trigger exists
SELECT
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_confirm';

-- 6. Check if auto-confirm function exists
SELECT
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE proname = 'auto_confirm_user';
