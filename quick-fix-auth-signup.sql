-- ============================================
-- QUICK FIX: Auth Signup Database Error
-- ============================================
-- Run this script in Supabase SQL Editor to fix the immediate issue

-- Step 1: Make auth_user_id nullable (allows auth user to be created first)
ALTER TABLE billing_users
ALTER COLUMN auth_user_id DROP NOT NULL;

-- Step 2: Create auto-confirm function to bypass email confirmation
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

-- Step 3: Drop existing trigger if it exists (to avoid duplicates)
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;

-- Step 4: Create trigger to auto-confirm all new users
CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- Step 5: Confirm any existing unconfirmed users
UPDATE auth.users
SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- Step 6: Verify the fix
SELECT
    'Fix applied successfully!' as status,
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
    AND tgname = 'on_auth_user_created_auto_confirm';
