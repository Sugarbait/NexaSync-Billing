# Demo User Setup Guide

## Quick Start - Demo Accounts

Here are the demo credentials you can use once set up:

### Super Admin Account (Full Access)
- **Email:** `demo@nexasync.com`
- **Password:** `Demo123456!`
- **Permissions:** Full access + user management

### Regular Admin Account
- **Email:** `admin@nexasync.com`
- **Password:** `Admin123456!`
- **Permissions:** Billing operations only (no user management)

---

## Setup Instructions

Since the app uses Supabase for authentication, you need to create the users in Supabase first. Follow these steps:

### Step 1: Set Up Supabase Project

1. **Go to your Supabase project**: https://supabase.com/dashboard
2. **Update `.env.local`** with your real Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 2: Run Database Migrations

In your Supabase project, go to **SQL Editor** and run these migration files in order:

1. `20251001000001_create_billing_tables.sql`
2. `20251001000002_add_retell_agent_ids.sql`
3. `20251001000003_add_retell_api_config.sql`
4. `20251001000004_add_twilio_config.sql`
5. `20251001000005_add_user_management.sql`

### Step 3: Create Auth Users in Supabase Dashboard

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **"Add user"**
3. Create the first user:
   - **Email:** `demo@nexasync.com`
   - **Password:** `Demo123456!`
   - **Auto Confirm User:** ✅ (check this box)
   - Click **Create User**
4. **Copy the User UUID** from the users table (you'll need this)

5. Repeat for the second user:
   - **Email:** `admin@nexasync.com`
   - **Password:** `Admin123456!`
   - **Auto Confirm User:** ✅
   - Click **Create User**
6. **Copy this User UUID** as well

### Step 4: Create Billing User Records

1. Go to **SQL Editor** in Supabase
2. Run this SQL (replace the UUIDs with the actual ones from Step 3):

```sql
-- Insert Super Admin user
INSERT INTO billing_users (
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  mfa_enabled,
  created_at,
  updated_at
) VALUES (
  'PASTE_DEMO_USER_UUID_HERE'::uuid,
  'demo@nexasync.com',
  'Demo Super Admin',
  'super_admin',
  true,
  false,
  NOW(),
  NOW()
);

-- Insert Regular Admin user
INSERT INTO billing_users (
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  mfa_enabled,
  created_at,
  updated_at
) VALUES (
  'PASTE_ADMIN_USER_UUID_HERE'::uuid,
  'admin@nexasync.com',
  'Demo Admin User',
  'admin',
  true,
  false,
  NOW(),
  NOW()
);
```

### Step 5: Restart Dev Server

```bash
cd ../nexasync-billing
PORT=3002 npm run dev
```

### Step 6: Login

1. Go to: http://localhost:3002/login
2. Login with either:
   - `demo@nexasync.com` / `Demo123456!` (Super Admin)
   - `admin@nexasync.com` / `Admin123456!` (Regular Admin)

---

## What Each User Can Do

### Super Admin (`demo@nexasync.com`)
✅ View Dashboard
✅ Manage Customers
✅ Generate Invoices
✅ View Invoice History
✅ **Manage Users** (add/remove users)
✅ Configure Settings
✅ View Profile
✅ Enable MFA

### Regular Admin (`admin@nexasync.com`)
✅ View Dashboard
✅ Manage Customers
✅ Generate Invoices
✅ View Invoice History
✅ Configure Settings
✅ View Profile
✅ Enable MFA
❌ Cannot manage users (Users page not visible)

---

## Testing MFA

1. Login as any user
2. Go to **Profile** (click your name in top right)
3. Click **"Enable MFA"** button
4. Follow the 3-step wizard:
   - Generate secret
   - Scan QR code with Google Authenticator/Authy
   - Enter 6-digit code to verify
5. Save the backup codes!
6. Logout and try logging in again - you'll need the TOTP code

---

## Troubleshooting

### "User not authorized for billing system"
- Make sure you ran the SQL INSERT statements to create the `billing_users` records
- Check that the `auth_user_id` matches the UUID from Supabase Auth

### "Failed to load customers"
- Make sure you updated `.env.local` with real Supabase credentials
- Restart the dev server after updating env variables

### Can't see "Users" menu item
- This is normal for regular admins
- Only Super Admins can see the Users management page
- Login as `demo@nexasync.com` to access user management

---

## Production Note

⚠️ **These are DEMO credentials only!**

In production:
1. Delete these demo users
2. Create real users with strong passwords
3. Enable MFA for all users
4. Use proper encryption for MFA secrets (not just base64)
5. Set up proper email confirmation flows
6. Configure Supabase Auth policies
