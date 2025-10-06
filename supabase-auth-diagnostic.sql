-- ========================================
-- COMPREHENSIVE SUPABASE AUTH DIAGNOSTICS
-- ========================================
-- Run this entire script in Supabase SQL Editor to diagnose signup issues
-- This will show you EXACTLY what's preventing user creation

-- ========================================
-- 1. CHECK ALL TRIGGERS ON auth.users
-- ========================================
SELECT
    tgname AS trigger_name,
    tgenabled AS enabled,
    tgtype AS trigger_type,
    CASE
        WHEN tgtype & 1 = 1 THEN 'ROW'
        ELSE 'STATEMENT'
    END AS level,
    CASE
        WHEN tgtype & 2 = 2 THEN 'BEFORE'
        WHEN tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END AS timing,
    CASE
        WHEN tgtype & 4 = 4 THEN 'INSERT'
        WHEN tgtype & 8 = 8 THEN 'DELETE'
        WHEN tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'TRUNCATE'
    END AS event,
    pg_get_functiondef(tgfoid) AS function_definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
    AND tgisinternal = false
ORDER BY tgname;

-- ========================================
-- 2. CHECK ALL CONSTRAINTS ON auth.users
-- ========================================
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        WHEN 'x' THEN 'EXCLUSION'
    END AS constraint_type_name,
    pg_get_constraintdef(oid) AS constraint_definition,
    convalidated AS is_validated
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
ORDER BY contype, conname;

-- ========================================
-- 3. CHECK RLS POLICIES ON auth.users
-- ========================================
SELECT
    schemaname,
    tablename,
    policyname AS policy_name,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'auth' AND tablename = 'users'
ORDER BY policyname;

-- ========================================
-- 4. CHECK IF RLS IS ENABLED ON auth.users
-- ========================================
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'auth' AND tablename = 'users';

-- ========================================
-- 5. CHECK COLUMN CONSTRAINTS ON auth.users
-- ========================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'auth'
    AND table_name = 'users'
ORDER BY ordinal_position;

-- ========================================
-- 6. CHECK FOR FAILED TRIGGERS OR FUNCTIONS
-- ========================================
-- Look for any custom functions that might be called by triggers
SELECT
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('auth', 'public')
    AND (
        p.proname LIKE '%confirm%'
        OR p.proname LIKE '%user%'
        OR p.proname LIKE '%auth%'
    )
    AND p.prokind = 'f' -- functions only, not procedures
ORDER BY n.nspname, p.proname;

-- ========================================
-- 7. CHECK auth.users TABLE PERMISSIONS
-- ========================================
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'auth'
    AND table_name = 'users'
ORDER BY grantee, privilege_type;

-- ========================================
-- 8. CHECK FOR CIRCULAR DEPENDENCIES
-- ========================================
-- Check if billing_users has triggers that reference auth.users
SELECT
    tgname AS trigger_name,
    tgenabled AS enabled,
    pg_get_functiondef(tgfoid) AS function_definition
FROM pg_trigger
WHERE tgrelid = 'billing_users'::regclass
    AND tgisinternal = false
ORDER BY tgname;

-- ========================================
-- 9. CHECK EXISTING USERS AND THEIR STATUS
-- ========================================
SELECT
    au.id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.confirmed_at,
    au.last_sign_in_at,
    bu.id AS billing_user_id,
    bu.auth_user_id AS billing_auth_user_id,
    bu.role
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
ORDER BY au.created_at DESC
LIMIT 10;

-- ========================================
-- 10. CHECK FOR ORPHANED RECORDS
-- ========================================
-- Users in auth.users but not in billing_users
SELECT
    au.id,
    au.email,
    au.created_at,
    'Missing in billing_users' AS issue
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE bu.id IS NULL;

-- Users in billing_users but not in auth.users
SELECT
    bu.id,
    bu.email,
    bu.created_at,
    'Missing in auth.users' AS issue
FROM billing_users bu
LEFT JOIN auth.users au ON bu.auth_user_id = au.id
WHERE bu.auth_user_id IS NOT NULL
    AND au.id IS NULL;

-- ========================================
-- 11. CHECK auth.identities TABLE
-- ========================================
-- Sometimes identity creation fails
SELECT
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at
FROM auth.identities
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 12. CHECK FOR DATABASE LOCKS
-- ========================================
SELECT
    locktype,
    database,
    relation::regclass,
    page,
    tuple,
    virtualxid,
    transactionid,
    mode,
    granted
FROM pg_locks
WHERE relation = 'auth.users'::regclass;

-- ========================================
-- 13. CHECK SUPABASE AUTH CONFIGURATION
-- ========================================
-- Check if there are any configuration issues
SELECT
    name,
    setting,
    unit,
    context,
    vartype,
    source,
    min_val,
    max_val
FROM pg_settings
WHERE name LIKE '%auth%'
    OR name LIKE '%security%'
ORDER BY name;

-- ========================================
-- END OF DIAGNOSTICS
-- ========================================
-- Review all outputs above to identify:
-- 1. Failed triggers
-- 2. Violated constraints
-- 3. RLS blocking inserts
-- 4. Missing permissions
-- 5. Circular dependencies
