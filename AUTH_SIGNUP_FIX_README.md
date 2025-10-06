# Fix: "Database error saving new user" - Supabase Auth Signup Issue

## Problem Summary

When attempting to create users via `supabase.auth.signUp()` in the billing admin panel, you're getting:
- **HTTP 500 Internal Server Error** from `/auth/v1/signup`
- **Error message:** "AuthApiError: Database error saving new user"

## Root Causes

After analyzing your codebase, the issue is likely caused by one or more of these factors:

### 1. Email Confirmation Blocking User Creation
Supabase's default behavior requires email confirmation. If the email provider is not configured properly or if there are issues with the confirmation process, the user creation can fail.

### 2. Foreign Key Constraint Issues
Your `billing_users` table has:
```sql
auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
```

If this column is set to NOT NULL, it can cause timing issues where the auth.users record must be created before the billing_users record, but database transactions might interfere.

### 3. Database Triggers
If there are any custom triggers on the `auth.users` table that fail, they can block user creation entirely.

## Solution Options

### OPTION 1: Quick Fix (Recommended for Development)

**Run this SQL in Supabase SQL Editor:**

```sql
-- File: quick-fix-auth-signup.sql
-- Run this entire script at once

-- Step 1: Make auth_user_id nullable
ALTER TABLE billing_users
ALTER COLUMN auth_user_id DROP NOT NULL;

-- Step 2: Create auto-confirm function
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW());
    RETURN NEW;
END;
$$;

-- Step 3: Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;

-- Step 4: Create new trigger
CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- Step 5: Fix existing users
UPDATE auth.users
SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;
```

**What this does:**
1. Allows `auth_user_id` to be NULL temporarily during user creation
2. Auto-confirms all new users immediately (bypasses email confirmation)
3. Fixes any existing unconfirmed users

**When to use:**
- Development environment
- Internal tools where email verification isn't required
- When you want quick user creation

### OPTION 2: Production-Safe Approach

For production, you should NOT auto-confirm users. Instead:

1. **Configure Email Provider in Supabase:**
   - Go to Supabase Dashboard > Authentication > Settings > Email Auth
   - Configure SMTP settings or use Supabase's built-in email
   - Test email delivery

2. **Update Supabase Auth Settings:**
   - Go to Supabase Dashboard > Authentication > Settings
   - Under "Email Auth", ensure "Enable email confirmations" is checked
   - Set "Confirm email" to your preference

3. **Use Magic Links Instead:**
   Replace password signups with magic link invites:
   ```typescript
   const { data, error } = await supabase.auth.signInWithOtp({
     email: 'user@example.com',
     options: {
       emailRedirectTo: `${window.location.origin}/auth/callback`,
     }
   })
   ```

### OPTION 3: Server-Side User Creation (Most Secure)

Create a Next.js API route using the Supabase Admin API:

**File: `app/api/admin/create-user/route.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create admin client with service role key (server-side only!)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key - NEVER expose to client
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    // Verify the requesting user is a super admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify user session
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const { data: billingUser } = await supabaseAdmin
      .from('billing_users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!billingUser || billingUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const { email, password, full_name, role } = await request.json()

    // Create user with admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for admin-created users
      user_metadata: {
        full_name
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Create billing_users record
    const { data: billingUserData, error: billingError } = await supabaseAdmin
      .from('billing_users')
      .insert({
        auth_user_id: authData.user.id,
        email,
        full_name,
        role,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single()

    if (billingError) {
      // Rollback: delete auth user if billing user creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.error('Billing user error:', billingError)
      return NextResponse.json({ error: billingError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: billingUserData
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Environment variables needed:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # KEEP SECRET!
```

**Update your frontend code (`app/admin/billing/users/page.tsx`):**

```typescript
// Replace the current signup code (lines 119-134) with:
const response = await fetch('/api/admin/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}` // Get from supabase.auth.getSession()
  },
  body: JSON.stringify({
    email: formData.email,
    password: formData.password,
    full_name: formData.full_name,
    role: formData.role
  })
})

const result = await response.json()

if (!response.ok) {
  throw new Error(result.error || 'Failed to create user')
}

showNotification('User created successfully!', 'success')
```

## Which Solution Should You Use?

| Solution | Use Case | Security | Complexity |
|----------|----------|----------|------------|
| **Option 1** | Development, internal tools | Low (auto-confirms users) | Simple |
| **Option 2** | Production with email verification | High | Medium |
| **Option 3** | Production, enterprise apps | Highest (server-side only) | Complex |

## Recommended Implementation

**For immediate fix:** Use Option 1 (quick-fix-auth-signup.sql)

**For production:** Implement Option 3 (server-side API route)

## Testing the Fix

After applying the fix, test user creation:

1. Go to your admin panel
2. Click "Add User"
3. Fill in the form:
   - Full Name: Test User
   - Email: test@example.com
   - Password: TestPassword123
   - Role: Admin
4. Submit the form

**Expected result:** User should be created successfully without errors.

## Verification Queries

Run these in Supabase SQL Editor to verify:

```sql
-- Check if trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- Check recent users
SELECT
    au.id,
    au.email,
    au.email_confirmed_at,
    bu.full_name,
    bu.role
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
ORDER BY au.created_at DESC
LIMIT 10;

-- Check for unconfirmed users
SELECT id, email, created_at
FROM auth.users
WHERE email_confirmed_at IS NULL;
```

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/admin-api)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Support

If you continue to experience issues:
1. Check Supabase logs: Dashboard > Logs > Auth
2. Review PostgreSQL error logs
3. Verify your Supabase project settings
4. Contact Supabase support if the issue persists
