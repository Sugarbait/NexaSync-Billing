# Supabase Authentication Fix Guide

## Problem Summary

Users cannot log in and receive "Invalid login credentials" error despite:
- Email confirmation disabled in Supabase Dashboard
- Auto-confirm trigger created
- Users created via `supabase.auth.signUp()`

## Root Cause Analysis

Based on the code review, there are several potential issues:

### Issue 1: AFTER INSERT Trigger (Not Effective)
Your current trigger runs **AFTER INSERT**, which means the record is already created before the confirmation fields are set. This creates a race condition where Supabase may cache the unconfirmed state.

```sql
-- Current (PROBLEMATIC) trigger
CREATE TRIGGER on_auth_user_created_confirm
  AFTER INSERT ON auth.users  -- ❌ Too late!
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user();
```

### Issue 2: Email Confirmation Settings
Even with "Confirm email" disabled in the dashboard, Supabase may still require email confirmation for certain flows.

### Issue 3: Potential Session/Cache Issues
The authentication state might be cached by Supabase's auth system.

## Complete Fix (Step-by-Step)

### Step 1: Run Diagnostic Queries

1. Open Supabase Dashboard → SQL Editor
2. Run the diagnostic script: `diagnose-auth.sql`
3. Check the results to see:
   - Which users have `email_confirmed_at` set to NULL
   - If billing_users and auth.users are in sync
   - If the trigger exists and is enabled

### Step 2: Apply the Complete Fix

Run the `fix-auth.sql` script in Supabase SQL Editor. This will:

1. **Confirm all existing users** that are unconfirmed
2. **Replace the AFTER INSERT trigger with BEFORE INSERT trigger**
3. **Sync auth.users with billing_users**
4. **Clean up orphaned records**

### Step 3: Verify Email Provider Settings

1. Go to Supabase Dashboard → Authentication → Providers
2. Click on **Email**
3. Ensure these settings:
   - ✅ **Enable email provider**: ON
   - ❌ **Confirm email**: OFF (disabled)
   - ✅ **Secure email change**: OFF (for testing)
   - ❌ **Double confirm email changes**: OFF

### Step 4: Test with New User

After applying the fixes, test creating a new user:

1. Go to your app's user management page
2. Create a new user with:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Role: Admin
3. Try to log in immediately with these credentials
4. Should work without email confirmation

### Step 5: Alternative - Use Service Role for User Creation

If the above doesn't work, you need to use the **Service Role Key** for user creation (server-side only):

```typescript
// Create a server-side Supabase client (NEVER expose this key to the frontend!)
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Use admin client to create users
async function createUser(email: string, password: string, fullName: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName
    }
  })

  if (error) throw error
  return data.user
}
```

## Implementation Steps

### Option A: Fix Trigger (Recommended First)

1. Run `fix-auth.sql` in Supabase SQL Editor
2. Verify email settings in dashboard
3. Test creating a new user
4. Try logging in immediately

### Option B: Server-Side User Creation (If Option A fails)

1. Add service role key to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. Create API route for user creation: `/api/admin/create-user.ts`

3. Update user management page to call this API instead of client-side `signUp`

## Testing Checklist

- [ ] Run diagnostic queries to identify current state
- [ ] Apply fix-auth.sql script
- [ ] Verify email provider settings in dashboard
- [ ] Create a new test user
- [ ] Attempt to log in with new user (should work immediately)
- [ ] Check that billing_users record is created
- [ ] Verify MFA setup works (if enabled)

## Common Mistakes to Avoid

1. ❌ **Don't use AFTER INSERT trigger** - Use BEFORE INSERT instead
2. ❌ **Don't forget to disable email confirmation** in Supabase Dashboard
3. ❌ **Don't expose service role key** to frontend code
4. ❌ **Don't create users client-side** if you need auto-confirmation (use server-side API)
5. ❌ **Don't forget to sync** billing_users with auth.users

## Files Created

1. **diagnose-auth.sql** - Diagnostic queries to check current state
2. **fix-auth.sql** - Complete fix script
3. **test-user-creation.ts** - Test script to verify authentication flow
4. **AUTHENTICATION-FIX-GUIDE.md** - This guide

## Next Steps

1. Run `diagnose-auth.sql` first to understand the current state
2. Run `fix-auth.sql` to apply all fixes
3. Test creating and logging in with a new user
4. If still not working, implement Option B (server-side user creation)

## Support

If you continue to have issues after following this guide, check:

1. Supabase logs in Dashboard → Logs → Auth logs
2. Browser console for detailed error messages
3. Network tab to see the actual API response from Supabase

## Database Schema Verification

Ensure your `billing_users` table has these constraints:

```sql
-- Check if auth_user_id is unique
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'billing_users'
AND constraint_type = 'UNIQUE';

-- Add unique constraint if missing
ALTER TABLE billing_users
ADD CONSTRAINT billing_users_auth_user_id_key
UNIQUE (auth_user_id);
```
