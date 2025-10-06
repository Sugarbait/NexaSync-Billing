-- ==========================================
-- COMPLETE DIAGNOSTIC FOR AUTH.USERS ISSUES
-- Run this entire script in Supabase SQL Editor
-- ==========================================

-- SECTION 1: CHECK ALL TRIGGERS ON auth.users
SELECT '=== TRIGGERS ON auth.users ===' as section;
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- SECTION 2: CHECK ALL FOREIGN KEY CONSTRAINTS ON auth.users
SELECT '=== FOREIGN KEYS ON auth.users ===' as section;
SELECT
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'auth'
  AND tc.table_name = 'users';

-- SECTION 3: CHECK ALL CHECK CONSTRAINTS ON auth.users
SELECT '=== CHECK CONSTRAINTS ON auth.users ===' as section;
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'auth'
  AND rel.relname = 'users'
  AND con.contype = 'c';

-- SECTION 4: CHECK ALL UNIQUE CONSTRAINTS ON auth.users
SELECT '=== UNIQUE CONSTRAINTS ON auth.users ===' as section;
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'auth'
  AND rel.relname = 'users'
  AND con.contype = 'u';

-- SECTION 5: CHECK NOT NULL CONSTRAINTS ON auth.users
SELECT '=== NOT NULL COLUMNS ON auth.users ===' as section;
SELECT
    a.attname AS column_name,
    t.typname AS data_type,
    a.attnotnull AS not_null
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attnotnull = true
ORDER BY a.attnum;

-- SECTION 6: GET FUNCTION DEFINITION FOR auto_confirm_user
SELECT '=== auto_confirm_user FUNCTION ===' as section;
SELECT
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_confirm_user';

-- SECTION 7: CHECK ALL BEFORE INSERT TRIGGERS ON auth.users
SELECT '=== BEFORE INSERT TRIGGERS ON auth.users ===' as section;
SELECT
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND t.tgtype & 2 = 2  -- BEFORE trigger
  AND t.tgtype & 4 = 4  -- INSERT trigger
ORDER BY t.tgname;

-- SECTION 8: CHECK RLS POLICIES ON auth.users
SELECT '=== RLS POLICIES ON auth.users ===' as section;
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
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- SECTION 9: CHECK TABLE OWNERSHIP AND PERMISSIONS
SELECT '=== TABLE OWNERSHIP FOR auth.users ===' as section;
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    pg_catalog.pg_get_userbyid(c.relowner) AS owner,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users';

-- SECTION 10: CHECK FOR ANY RULES ON auth.users
SELECT '=== RULES ON auth.users ===' as section;
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    r.rulename AS rule_name,
    pg_get_ruledef(r.oid) AS rule_definition
FROM pg_rewrite r
JOIN pg_class c ON r.ev_class = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND r.rulename != '_RETURN';

-- SECTION 11: CHECK billing_users FOREIGN KEYS
SELECT '=== FOREIGN KEYS ON billing_users ===' as section;
SELECT
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'billing_users';

-- SECTION 12: CHECK billing_users TRIGGERS
SELECT '=== TRIGGERS ON billing_users ===' as section;
SELECT
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname = 'billing_users'
ORDER BY t.tgname;

-- SECTION 13: CHECK billing_users STRUCTURE
SELECT '=== billing_users TABLE STRUCTURE ===' as section;
SELECT
    a.attname AS column_name,
    t.typname AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(d.adbin, d.adrelid) AS default_value
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
WHERE n.nspname = 'public'
  AND c.relname = 'billing_users'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- SECTION 14: CHECK IF THERE'S A TRIGGER THAT TRIES TO INSERT INTO billing_users
SELECT '=== FUNCTIONS THAT REFERENCE billing_users ===' as section;
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%billing_users%'
  AND n.nspname IN ('public', 'auth');
