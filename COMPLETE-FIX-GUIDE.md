# Complete Fix Guide for "Database error creating new user"

## Problem Summary
Getting "Database error creating new user" when using `supabaseAdmin.auth.admin.createUser()` with service role key.

## Root Causes (Most Likely)
1. **Triggers on auth.users** - A BEFORE INSERT trigger is failing
2. **Foreign Key Constraints** - billing_users → auth.users FK is blocking
3. **NOT NULL Constraints** - Required fields in auth.users or billing_users
4. **RLS Policies** - Even service_role might be affected in some cases
5. **Webhook/Edge Function** - External service failing during user creation

## Step-by-Step Fix Process

### Step 1: Run Diagnostic Script
Copy and paste the entire content of `SUPABASE-DIAGNOSTIC-COMPLETE.sql` into Supabase SQL Editor and run it.

**What to look for:**
- Any triggers on `auth.users` (Section 1, 7)
- Foreign key constraints (Section 2, 11)
- Check constraints or unique constraints (Section 3, 4)
- NOT NULL columns (Section 5)
- Functions that reference billing_users (Section 14)

### Step 2: Choose Your Fix Strategy

#### Option A: RECOMMENDED - Nuclear Fix (Fastest)
If you need this working NOW and don't care about preserving triggers:

1. Run `NUCLEAR-FIX.sql` in Supabase SQL Editor
2. This will:
   - Disable ALL triggers on auth.users
   - Remove ALL foreign key constraints
   - Reset RLS policies to minimal
   - Grant all permissions to service_role
3. Test user creation immediately

#### Option B: Conservative Fix (Preserves some functionality)
If you want to keep auto-confirmation but fix issues:

1. Run `FIX-AUTH-USERS-COMPLETE.sql` in Supabase SQL Editor
2. This will:
   - Replace problematic triggers with safe ones
   - Keep email auto-confirmation
   - Fix billing_users constraints
   - Update RLS policies

#### Option C: Complete Clean Slate
If you want NO triggers at all:

1. Run `ALTERNATIVE-FIX.sql` in Supabase SQL Editor
2. This removes ALL triggers and lets `email_confirm: true` parameter handle confirmation

### Step 3: Verify the Fix

After running your chosen fix, test with this curl command:

```bash
curl -X POST http://localhost:3002/api/admin/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "full_name": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "user": { ... },
  "message": "User created successfully"
}
```

### Step 4: If Still Failing

#### Check Application Logs
1. Open browser console (F12)
2. Look for the exact error message
3. Check Network tab for the API response

#### Check Supabase Logs
1. Go to Supabase Dashboard
2. Click on "Logs" → "Postgres Logs"
3. Look for errors around the time of user creation attempt
4. Common errors to look for:
   - "violates foreign key constraint"
   - "null value in column"
   - "permission denied"
   - "function does not exist"

#### Run Additional Checks
Run `CHECK-FOR-WEBHOOKS.sql` to see if there are webhooks or edge functions interfering.

## Common Issues and Solutions

### Issue: "violates foreign key constraint"
**Solution:** Drop the FK constraint from billing_users to auth.users
```sql
-- Find the constraint name first
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'billing_users'
  AND constraint_type = 'FOREIGN KEY';

-- Then drop it (replace CONSTRAINT_NAME with actual name)
ALTER TABLE billing_users DROP CONSTRAINT CONSTRAINT_NAME;
```

### Issue: "null value in column violates not-null constraint"
**Solution:** Make auth_user_id nullable
```sql
ALTER TABLE billing_users ALTER COLUMN auth_user_id DROP NOT NULL;
```

### Issue: "permission denied for table auth.users"
**Solution:** This is unusual with service_role, but try:
```sql
GRANT ALL ON auth.users TO service_role;
```

### Issue: "function auto_confirm_user() does not exist"
**Solution:** The trigger references a missing function
```sql
-- Drop the broken trigger
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
```

### Issue: Trigger succeeds but user still not created
**Solution:** A trigger is returning NULL instead of NEW
```sql
-- Check all trigger functions
SELECT pg_get_functiondef(tgfoid::regproc)
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- Look for functions that don't RETURN NEW
```

## Prevention for Future

### Best Practice: No Auto-Creation Triggers
Instead of using triggers to auto-create billing_users, handle it in your API:

```typescript
// In your API route
const { data: authData, error: authError } =
  await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name }
  })

// Then explicitly create billing_users
const { data: billingUser, error: billingError } =
  await supabaseAdmin
    .from('billing_users')
    .insert({ auth_user_id: authData.user.id, ... })
```

### Best Practice: Nullable Foreign Keys
Make auth_user_id nullable and add the FK later:

```sql
ALTER TABLE billing_users
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- Optional: Add FK without NOT NULL
ALTER TABLE billing_users
  ADD CONSTRAINT billing_users_auth_user_id_fkey
  FOREIGN KEY (auth_user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
```

### Best Practice: Service Role Policies
Always ensure service_role can bypass everything:

```sql
CREATE POLICY "service_role_full_access"
  ON billing_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## SQL Files Reference

| File | Purpose | When to Use |
|------|---------|-------------|
| `SUPABASE-DIAGNOSTIC-COMPLETE.sql` | Diagnose the issue | Always run this first |
| `NUCLEAR-FIX.sql` | Disable all triggers, reset everything | When you need it working NOW |
| `FIX-AUTH-USERS-COMPLETE.sql` | Fix while keeping auto-confirm | When you want to preserve functionality |
| `ALTERNATIVE-FIX.sql` | Remove all triggers completely | When you want clean slate |
| `CHECK-FOR-WEBHOOKS.sql` | Check for webhooks/edge functions | If above fixes don't work |

## Still Not Working?

If none of these fixes work, the issue might be:

1. **Supabase Edge Function** - Check if you have any Edge Functions that intercept auth.users inserts
2. **Database Replication Issue** - Rare but possible; contact Supabase support
3. **API Key Issue** - Verify your service role key is correct and has admin privileges
4. **Supabase Version** - Some older versions had bugs; check dashboard for updates

### Contact Support
Provide this information:
- Error message from browser console
- Postgres logs from Supabase dashboard
- Output from SUPABASE-DIAGNOSTIC-COMPLETE.sql
- Which fix script you ran
- Supabase project ID
