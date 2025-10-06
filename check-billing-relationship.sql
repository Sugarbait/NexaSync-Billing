-- Check the billing_users table and its relationship to auth.users
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

-- Check if billing_users has any triggers that fire on auth.users insert
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

-- Check the billing_users table structure
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
