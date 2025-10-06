# Authentication Fix Checklist

Follow these steps in order to fix the Supabase authentication issue.

## Step 1: Backup Current State

- [ ] Run `diagnose-auth.sql` in Supabase SQL Editor
- [ ] Save the results for reference
- [ ] Note how many users have `email_confirmed_at = NULL`

## Step 2: Apply the Quick Fix

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy the SQL from `QUICK-FIX-README.md` (the 4-part SQL script)
- [ ] Run the SQL script
- [ ] Verify no errors occurred

## Step 3: Verify Dashboard Settings

- [ ] Go to Supabase Dashboard → Authentication → Providers
- [ ] Click on **Email**
- [ ] Verify these settings:
  - [ ] "Enable email provider" is **ON**
  - [ ] "Confirm email" is **OFF**
  - [ ] "Secure email change" is **OFF** (for testing)

## Step 4: Verify the Fix

- [ ] Run `verify-fix.sql` in Supabase SQL Editor
- [ ] Check that all results show ✅
- [ ] If any show ❌, run `fix-auth.sql`

## Step 5: Test with Existing User

- [ ] Pick an existing user email from your system
- [ ] Try to log in with their credentials
- [ ] If login works → ✅ Fix successful!
- [ ] If login fails → Check Step 6

## Step 6: Test with New User

- [ ] Go to your app's user management page
- [ ] Create a new test user:
  - Email: `test-[timestamp]@example.com`
  - Password: `TestPassword123!`
  - Role: Admin
- [ ] Try to log in immediately with the new credentials
- [ ] If login works → ✅ Fix successful!
- [ ] If login fails → Proceed to Step 7

## Step 7: Alternative Solution (If Quick Fix Failed)

Only do this if Steps 1-6 didn't work:

- [ ] Get your Service Role key from Supabase Dashboard → Settings → API
- [ ] Add to `.env.local`:
  ```
  SUPABASE_SERVICE_ROLE_KEY=your_key_here
  ```
- [ ] The API route is already created at `app/api/admin/create-user/route.ts`
- [ ] Open `app/admin/billing/users/page.tsx`
- [ ] Replace the `handleSubmit` function with code from `UPDATED-USER-CREATION-CODE.tsx`
- [ ] Restart your Next.js dev server
- [ ] Test creating a new user
- [ ] Try logging in with the new user

## Step 8: Clean Up Test Users (Optional)

- [ ] Delete any test users created during testing
- [ ] Run this SQL to remove test users:
  ```sql
  DELETE FROM billing_users WHERE email LIKE 'test-%@example.com';
  DELETE FROM auth.users WHERE email LIKE 'test-%@example.com';
  ```

## Troubleshooting

### If Quick Fix Didn't Work:

1. **Check trigger timing:**
   ```sql
   SELECT tgname, tgtype FROM pg_trigger WHERE tgname = 'on_auth_user_created_confirm';
   ```
   - tgtype should be 2 (BEFORE INSERT)

2. **Check for unconfirmed users:**
   ```sql
   SELECT email, email_confirmed_at FROM auth.users WHERE email_confirmed_at IS NULL;
   ```
   - Should return 0 rows

3. **Check Supabase Auth logs:**
   - Go to Supabase Dashboard → Logs → Auth logs
   - Look for recent login attempts
   - Check error messages

### Common Issues:

- **Issue:** "Invalid login credentials"
  - **Cause:** User not confirmed
  - **Fix:** Run Step 2 again

- **Issue:** "User not authorized for billing system"
  - **Cause:** No billing_users record
  - **Fix:** Run sync query from `fix-auth.sql`

- **Issue:** "User account is inactive"
  - **Cause:** is_active = false
  - **Fix:** Update billing_users: `UPDATE billing_users SET is_active = true WHERE email = 'user@example.com';`

## Success Criteria

You'll know it's working when:

- ✅ No more "Invalid login credentials" errors
- ✅ New users can log in immediately after creation
- ✅ Existing users can log in
- ✅ `verify-fix.sql` shows all green checkmarks
- ✅ No errors in Supabase Auth logs

## Files Reference

Quick access to all the files:

1. **Diagnostic:** `diagnose-auth.sql`
2. **Complete Fix:** `fix-auth.sql`
3. **Quick Fix:** `QUICK-FIX-README.md`
4. **Verification:** `verify-fix.sql`
5. **Testing:** `test-user-creation.ts`
6. **Documentation:** `SOLUTION-SUMMARY.md`, `AUTHENTICATION-FIX-GUIDE.md`
7. **Code:** `app/api/admin/create-user/route.ts`, `UPDATED-USER-CREATION-CODE.tsx`

---

**Current Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

**Time Estimate:** 5-10 minutes for Quick Fix, 15-20 minutes for Alternative Solution

**Last Updated:** 2025-10-05
