-- ==========================================
-- CHECK FOR WEBHOOKS AND HTTP TRIGGERS
-- These can also cause "Database error" messages
-- ==========================================

-- Check for pg_net webhooks
SELECT
    'Checking for pg_net webhooks...' as info;

-- Check if pg_net extension exists
SELECT
    extname,
    extversion
FROM pg_extension
WHERE extname = 'pg_net';

-- Check for HTTP requests (if pg_net is installed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE NOTICE 'pg_net extension is installed';
    ELSE
        RAISE NOTICE 'pg_net extension is NOT installed';
    END IF;
END $$;

-- Check for Supabase realtime publications
SELECT
    'Checking realtime publications...' as info;

SELECT
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE schemaname IN ('auth', 'public')
ORDER BY schemaname, tablename;

-- Check for any event triggers
SELECT
    'Checking event triggers...' as info;

SELECT
    evtname as trigger_name,
    evtevent as event,
    evtowner::regrole as owner,
    evtenabled as enabled
FROM pg_event_trigger
ORDER BY evtname;

-- Check for foreign data wrappers that might cause issues
SELECT
    'Checking foreign data wrappers...' as info;

SELECT
    srvname as server_name,
    srvoptions as options
FROM pg_foreign_server;

-- Check for any problematic extensions
SELECT
    'Checking installed extensions...' as info;

SELECT
    extname,
    extversion,
    extnamespace::regnamespace as schema
FROM pg_extension
ORDER BY extname;
