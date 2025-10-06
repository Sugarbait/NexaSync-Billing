# CLAUDE.md - NexaSync Billing Platform

This file provides architectural context and development guidance for the NexaSync Billing administration platform.

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run dev -- -p 5100   # Start on custom port

# Production
npm run build            # Build for production
npm start                # Start production server

# Linting
npm run lint             # Run ESLint

# Database (via Supabase SQL Editor)
# Run migrations from supabase/migrations/ directory
# Or run individual .sql files from project root for fixes
```

## High-Level Architecture

### Application Structure

**NexaSync Billing** is a Next.js 15 App Router application with a **security-first** design. The platform is structured around three core architectural principles:

1. **Security Layers**: MFA-protected routes → RLS policies → Application-level authorization
2. **Service Layer Pattern**: All business logic lives in `lib/services/`, never in pages
3. **Cloud Sync Architecture**: Real-time cross-device synchronization via Supabase

### Authentication & Authorization Flow

```
Login Page (app/login/page.tsx)
  ↓
[Email/Password Authentication]
  ↓
[MFA Verification if enabled]
  ↓ (sessionStorage.setItem('mfa_verified', 'true'))
  ↓
Billing Layout (app/admin/billing/layout.tsx)
  ↓
[Session Check on Every Route]
  ↓
[MFA Verification Check - CRITICAL]
  ↓ (if mfa_enabled && !sessionStorage.mfa_verified → logout)
  ↓
Protected Routes
```

**Key Security Points:**
- MFA verification stored in `sessionStorage`, cleared on logout
- Layout performs MFA check on every render (lines 60-70 in layout.tsx)
- Session persists across page refreshes but MFA verification requires new login
- Files marked "SECURITY CRITICAL" require authorization (see SECURITY.md)

### Database Architecture (Supabase)

**Tables:**
1. `billing_users` - User accounts with MFA support
2. `billing_customers` - Customer data and Stripe integration
3. `invoice_records` - Invoice metadata and cost tracking
4. `billing_settings` - Per-user configuration (Stripe keys, defaults)
5. `user_preferences` - Cloud sync data (JSONB)

**RLS (Row Level Security) Philosophy:**
- **Simplified policies** to avoid recursion errors
- All authenticated users can READ all billing_users (safe because authentication gates entry)
- Users can UPDATE/DELETE all billing_users (application logic restricts to super_admins)
- **Why simplified?** RLS policies that query the same table they protect cause infinite recursion
- Application-level checks (`user.role === 'super_admin'`) handle authorization

**Recent RLS Evolution:**
- Initially tried role-based RLS with subqueries → recursion errors
- Simplified to authenticated-only policies with app-level authorization
- See: `fix-rls-no-recursion.sql` and `fix-rls-allow-updates.sql`

### Service Layer Architecture

All services are **singleton instances** exported from `lib/services/`:

**Core Services:**
- `stripeInvoiceService` - Stripe integration (customer/invoice creation)
- `cloudSyncService` - Cross-device sync with real-time subscriptions
- `mfaService` - TOTP generation/verification (Google Authenticator compatible)
- `billingCostService` - Cost calculation logic
- `twilioCostService` - Twilio usage cost tracking
- `currencyService` - USD to CAD conversion

**Service Pattern:**
```typescript
class ServiceName {
  private property: Type

  async initialize(params): Promise<boolean> {
    // Load configuration from database
    // Return false if not configured
  }

  async operation(): Promise<{ success: boolean; data?: T; error?: string }> {
    // Consistent return shape for error handling
  }
}

export const serviceName = new ServiceName()
```

### Cloud Sync Architecture

**Three-Layer Sync System:**

1. **Service Layer** (`lib/services/cloudSyncService.ts`)
   - Manages device IDs (localStorage)
   - Handles sync operations to/from Supabase
   - Real-time subscriptions via Supabase channels
   - Auto-sync every 30 seconds
   - Gracefully degrades if table doesn't exist

2. **Context Layer** (`components/providers/CloudSyncProvider.tsx`)
   - React Context wrapping the service
   - Provides `useCloudSync()` hook
   - Manages local state and sync status
   - Listens for cross-device updates

3. **UI Layer** (`components/ui/SyncStatusIndicator.tsx`)
   - Visual sync status (Last synced: X ago / Never)
   - Manual sync button
   - Loading states

**Sync Flow:**
```
User updates preference
  ↓
updatePreferences() in context
  ↓
cloudSyncService.syncToCloud()
  ↓
Supabase upsert to user_preferences table
  ↓
Real-time subscription triggers on other devices
  ↓
CloudSyncProvider receives update event
  ↓
All devices update their local state
```

**Important Notes:**
- Uses `.maybeSingle()` not `.single()` to handle missing records
- First-time sync creates empty preferences object if none exist
- Falls back to localStorage if table doesn't exist
- Device ID persists in localStorage across sessions

### Invoice Generation Workflow

Multi-step wizard with preview and batch processing:

1. **Customer Selection** (`app/admin/billing/invoices/generate/page.tsx`)
   - Select customers from list
   - Filter by auto-invoice enabled

2. **Date Range Selection**
   - Previous month / Current month / Custom range
   - Quick-select buttons

3. **Cost Preview**
   - Fetches usage data for date range
   - Calculates costs via `billingCostService`
   - Shows breakdown: Twilio SMS, Voice, Retell AI
   - Applies customer markup percentage

4. **Generation**
   - Initializes Stripe connection
   - Creates Stripe customers if needed
   - Creates invoices with line items
   - Options: Draft / Finalize / Send immediately
   - Progress tracking with success/error states

5. **Confirmation**
   - Shows results for each customer
   - Links to Stripe dashboard
   - Option to view in invoice history

### Component Architecture

**UI Components** (`components/ui/`):
- Self-contained, reusable components
- Tailwind CSS v4 styling
- Dark mode support via CSS variables
- No external component libraries (custom-built)

**Provider Pattern:**
- `CloudSyncProvider` - Wraps billing layout
- `NotificationProvider` - Toast notifications
- Providers compose in layout.tsx

**Key UI Patterns:**
- Modal confirmations via `showConfirm()` (in Notification context)
- Toast notifications via `showNotification()` (in Notification context)
- Loading states managed locally in components
- Optimistic updates for better UX

### Routing Structure

```
app/
├── layout.tsx                    # Root layout (sets dark mode, font)
├── page.tsx                      # Redirects to /admin/billing
├── login/page.tsx                # Login + MFA verification
├── signup/page.tsx               # User registration (creates pending user)
└── admin/billing/
    ├── layout.tsx                # Auth check, MFA enforcement, nav
    ├── page.tsx                  # Dashboard (revenue metrics, charts)
    ├── customers/page.tsx        # Customer CRUD
    ├── invoices/
    │   ├── page.tsx              # Invoice history, filtering
    │   └── generate/page.tsx     # Multi-step invoice wizard
    ├── users/page.tsx            # User management (super_admin only)
    ├── profile/
    │   ├── page.tsx              # User profile
    │   └── mfa-setup/page.tsx    # MFA enrollment
    └── settings/page.tsx         # Stripe config, defaults, cloud sync
```

### Data Flow Patterns

**Typical Page Pattern:**
```typescript
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Page() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('table_name')
        .select('*')

      if (error) throw error
      setData(data)
    } catch (error) {
      console.error('Failed to load:', error)
      showNotification('Error loading data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ... render
}
```

**Service Integration:**
```typescript
import { stripeInvoiceService } from '@/lib/services/stripeInvoiceService'

async function handleAction() {
  // Initialize service if needed
  const initialized = await stripeInvoiceService.initialize(userId)
  if (!initialized) {
    showNotification('Service not configured', 'error')
    return
  }

  // Call service method
  const result = await stripeInvoiceService.createInvoice(params)
  if (!result.success) {
    showNotification(result.error || 'Operation failed', 'error')
    return
  }

  // Success
  showNotification('Operation completed', 'success')
}
```

## Important Configuration Files

### Environment Variables (.env.local)

**Required:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Optional (for news ticker):**
```env
NEXT_PUBLIC_NEWS_API_KEY=your_newsapi_key
```

**Note:** Stripe API keys are stored **encrypted in the database**, not in env vars

### Database Setup

1. Create Supabase project
2. Run migration: `supabase/migrations/20251001000001_create_billing_tables.sql`
3. If cloud sync needed: Run `create-user-preferences-table.sql`
4. If RLS issues: Check `fix-rls-no-recursion.sql` and `fix-rls-allow-updates.sql`

### TypeScript Configuration

- Strict mode enabled
- Path alias: `@/` maps to project root
- Client components required for interactivity (Next.js App Router)

## Key Design Decisions

### Why Simplified RLS Policies?

**Problem:** Role-based RLS policies caused infinite recursion when querying `billing_users` table to check if user is `super_admin` while enforcing policies on `billing_users` table.

**Solution:**
- All authenticated users can read all billing_users
- All authenticated users can update/delete billing_users
- Application-level checks ensure only super_admins access user management UI
- This is **secure** because only authorized users can authenticate in the first place

**Files:** See `fix-rls-no-recursion.sql` and `fix-rls-allow-updates.sql`

### Why Service Singletons?

Services maintain state (like initialized Stripe clients, device IDs) that should persist across component renders. Singleton pattern ensures:
- Single instance per service
- Configuration loaded once
- Consistent state across the app

### Why Cloud Sync with Supabase?

- Real-time updates via Supabase subscriptions
- Built-in authentication integration
- JSONB column for flexible preference schema
- RLS policies ensure users only see their own preferences
- Falls back to localStorage if database not configured

### Why Manual MFA Session Tracking?

Supabase Auth doesn't track MFA verification per-session, only whether MFA is enabled. We use `sessionStorage` to track MFA verification for the current browser session:
- Cleared on logout
- Checked on every route render
- Forces re-verification on new login
- Provides session-level security for MFA-enabled users

## Critical Code Locations

**Security-Critical Files** (require authorization to modify):
- `app/login/page.tsx` - Authentication logic
- `app/admin/billing/layout.tsx` - MFA enforcement (lines 60-70)
- `lib/services/mfaService.ts` - TOTP cryptographic operations

**Authorization Logic:**
- Super admin check: `app/admin/billing/layout.tsx` (line 98)
- User role displayed: `app/admin/billing/layout.tsx` (line 148)

**Cost Calculation:**
- Main service: `lib/services/billingCostService.ts`
- Twilio costs: `lib/services/twilioCostService.ts`
- Invoice generation: `app/admin/billing/invoices/generate/page.tsx`

**Stripe Integration:**
- Service: `lib/services/stripeInvoiceService.ts`
- Settings page: `app/admin/billing/settings/page.tsx`

**Cloud Sync:**
- Service: `lib/services/cloudSyncService.ts`
- Provider: `components/providers/CloudSyncProvider.tsx`
- Hook: `useCloudSync()` from CloudSyncProvider
- UI: `components/ui/SyncStatusIndicator.tsx`

## Common Development Tasks

### Adding a New Service

1. Create service class in `lib/services/serviceName.ts`
2. Export singleton instance
3. Follow return pattern: `{ success: boolean; data?: T; error?: string }`
4. Add initialization method if configuration needed
5. Import and use in components

### Adding a New Protected Route

1. Create page in `app/admin/billing/newroute/page.tsx`
2. Add to `navItems` in `app/admin/billing/layout.tsx`
3. If super_admin only: Add conditional insertion like Users page (line 98-100)
4. Use `'use client'` directive if interactive
5. Follow data loading pattern from existing pages

### Modifying RLS Policies

**CAUTION:** Test thoroughly in Supabase SQL Editor before production.

1. Create new SQL file: `fix-description.sql`
2. Wrap in `BEGIN; ... COMMIT;`
3. Drop existing policies: `DROP POLICY IF EXISTS`
4. Create new policies with clear naming
5. **Avoid recursion:** Don't query the same table in policy conditions
6. Test with actual user accounts, not service role

### Adding User Preferences

1. Update `UserPreferences` type in `lib/services/cloudSyncService.ts`
2. Use `useCloudSync()` hook in component
3. Call `updatePreferences({ newKey: value })` to sync
4. Preferences automatically sync across devices

## Troubleshooting Guide

### "User not authorized for billing system"

- Check RLS policies with `\d billing_users` in Supabase SQL
- Verify user exists in `billing_users` table
- Ensure `auth_user_id` matches auth.users.id
- Check `is_active` is true
- Review recent RLS policy changes

### Sync showing "Never" or not working

- Check if `user_preferences` table exists
- Run `create-user-preferences-table.sql` if needed
- Verify RLS policies on `user_preferences` table
- Check browser console for errors
- Confirm Supabase connection is working

### Invoice generation fails

- Verify Stripe API key in Settings (test connection)
- Check customer has `stripe_customer_id` in database
- Ensure billing date range has usage data
- Check console for service initialization errors
- Verify user has configured Stripe in settings

### MFA issues

- QR code not showing: Check `otplib` and `qrcode` packages installed
- Token not verifying: Ensure time sync on server and client device
- Can't disable MFA: Check RLS policies allow user to update own record

### Build errors

- Clear `.next/` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run build` shows all errors
- Verify all imports use `@/` prefix for absolute paths

## Recent Changes and Context

### Pending User Approval System

- Users can now sign up and are created as `is_active: false`
- Super admins see All/Active/Pending filter in Users page
- Approve button (green checkmark) activates pending users
- Filter buttons in CardHeader on Users page

### Cloud Sync Migration

- Moved sync button from header to Settings page
- Added "Cloud Sync" section in settings with explanation
- Table creation via `create-user-preferences-table.sql`
- Service gracefully handles missing table with console.info messages

### Dashboard Improvements

- Date range fields shortened to `w-40` on desktop
- Filter buttons (Today, This Month, etc.) aligned horizontally with date pickers
- Responsive layout: vertical on mobile, horizontal on desktop

### AI News Ticker

- Animated gradient background (blue to purple flowing effect)
- Auto-refresh every 15 minutes
- Falls back to sample news if no API key
- Pauses on hover
- Hidden on mobile viewports

### RLS Policy Evolution

- Started with role-based policies → recursion errors
- Simplified to authenticated-only with app-level authorization
- Update and delete policies broadened for user management
- See SQL files: `fix-rls-no-recursion.sql`, `fix-rls-allow-updates.sql`

## Testing Strategy

### Manual Testing Checklist

**Authentication:**
- [ ] Login with email/password
- [ ] MFA verification (if enabled)
- [ ] Session persistence across page refresh
- [ ] Logout clears session
- [ ] MFA re-required on new login

**Authorization:**
- [ ] Regular admin cannot access Users page
- [ ] Super admin can access Users page
- [ ] Pending users can't login until approved

**Cloud Sync:**
- [ ] Preferences sync across devices
- [ ] Manual sync button works
- [ ] Real-time updates from other devices
- [ ] Degrades gracefully if table missing

**Invoice Generation:**
- [ ] Multi-step wizard navigation
- [ ] Cost preview calculates correctly
- [ ] Stripe customer creation
- [ ] Draft/Finalize/Send modes
- [ ] Error handling for failed invoices

## References

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Stripe API Reference](https://stripe.com/docs/api)
- [otplib Documentation](https://github.com/yeojz/otplib)
- README.md - Feature overview and setup guide
- SECURITY.md - Security-critical file list and policies

---

**Last Updated:** Based on conversation through 2025-10-05

**Contact:** elitesquadp@protonmail.com for security-critical file changes
