# Quick Reference Card - Supabase Auth Fix

## One-Command Fix

Run this in **Supabase SQL Editor**:

```sql
-- Fix all users and create BEFORE INSERT trigger
UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
DROP FUNCTION IF EXISTS auto_confirm_user();
CREATE OR REPLACE FUNCTION auto_confirm_user() RETURNS trigger SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$ BEGIN NEW.email_confirmed_at := NOW(); NEW.confirmed_at := NOW(); RETURN NEW; END; $$;
CREATE TRIGGER on_auth_user_created_confirm BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION auto_confirm_user();
```

## Verify It Worked

```sql
-- Should return 'BEFORE' and 'ENABLED'
SELECT tgname, CASE WHEN tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created_confirm';
```

## Check Your Users

```sql
-- All should show ✅
SELECT email, CASE WHEN email_confirmed_at IS NOT NULL THEN '✅' ELSE '❌' END as status FROM auth.users;
```

## Test Login

1. Create new user in app
2. Try logging in immediately
3. Should work! ✅

## If Still Broken

Use server-side API:

1. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_key_here
   ```

2. API already created: `app/api/admin/create-user/route.ts`

3. Update users page with code from: `UPDATED-USER-CREATION-CODE.tsx`

## Key Files

| File | Purpose |
|------|---------|
| `QUICK-FIX-README.md` | 5-minute fix guide |
| `fix-auth.sql` | Complete fix script |
| `verify-fix.sql` | Check if fix worked |
| `FIX-CHECKLIST.md` | Step-by-step checklist |
| `SOLUTION-SUMMARY.md` | Full explanation |

## The Fix in One Line

**Change:** `AFTER INSERT` → `BEFORE INSERT`

**Why:** Sets confirmation BEFORE record creation, not after

## Dashboard Settings

Go to: **Authentication → Providers → Email**

- ✅ Enable email provider: ON
- ❌ Confirm email: OFF
- ❌ Secure email change: OFF

## Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid login credentials" | email_confirmed_at is NULL | Run fix SQL |
| "User not authorized" | No billing_users record | Run sync from fix-auth.sql |
| "User account is inactive" | is_active = false | Set to true |

## Troubleshooting

**Q: Still getting "Invalid login credentials"?**
A: Check if user is confirmed:
```sql
SELECT email, email_confirmed_at FROM auth.users WHERE email = 'user@example.com';
```

**Q: Trigger not working for new users?**
A: Verify trigger exists and is BEFORE:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created_confirm';
```

**Q: Want to manually confirm a specific user?**
A:
```sql
UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email = 'user@example.com';
```

## Success Indicators

- ✅ New users can log in immediately
- ✅ No "Invalid login credentials" errors
- ✅ verify-fix.sql shows all ✅
- ✅ No errors in Supabase Auth logs

---

**Location:** `I:\Apps Back Up\nexasync-billing\`
**Project:** NexaSync Billing
**Date:** 2025-10-05
