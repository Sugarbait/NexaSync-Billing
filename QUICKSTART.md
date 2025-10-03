# NexaSync Billing - Quick Start Guide

This guide will help you get the NexaSync Billing platform running in 10 minutes.

## Step 1: Prerequisites Check

Make sure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] A Supabase account and project
- [ ] A Stripe account (test mode is fine)

## Step 2: Install Dependencies

```bash
cd nexasync-billing
npm install
```

This will install all required packages including:
- Next.js, React, TypeScript
- Stripe SDK
- Supabase client
- Recharts for charts
- Zod for validation
- Lucide icons

## Step 3: Configure Environment

1. Copy the environment template:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and fill in your credentials:

```env
# Get these from your Supabase project settings > API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Get these from Stripe dashboard > Developers > API keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
```

## Step 4: Set Up Database

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Open `supabase/migrations/20251001000001_create_billing_tables.sql`
5. Copy the entire contents and paste into the SQL Editor
6. Click "Run"
7. Verify tables were created in "Table Editor"

### Option B: Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Step 5: Verify Database Setup

Check that these tables exist in your Supabase project:
- [ ] `billing_customers`
- [ ] `invoice_records`
- [ ] `billing_settings`

## Step 6: Start Development Server

```bash
npm run dev
```

The application will start at [http://localhost:3000](http://localhost:3000)

You should see a loading screen that redirects to `/admin/billing`

## Step 7: Initial Configuration

### Configure Stripe Integration

1. Navigate to Settings (gear icon in sidebar)
2. Enter your Stripe Secret Key (sk_test_... for test mode)
3. Enter your Stripe Publishable Key (pk_test_...)
4. Keep "Test Mode" enabled
5. Click "Save Stripe Settings"
6. Click "Test Connection" to verify

### Add Your First Customer

1. Navigate to Customers
2. Click "Add Customer"
3. Fill in:
   - Customer Name: "Test Company Inc."
   - Email: "billing@testcompany.com"
   - Markup Percentage: 20 (for 20% markup)
4. Click "Create Customer"

## Step 8: Test Invoice Generation

1. Navigate to Dashboard
2. Click "Generate Monthly Invoices"
3. Select "Previous Month" date range
4. Click "Next: Preview Invoices"
5. You should see your test customer (with $0 usage since there's no data yet)
6. Select the customer
7. Choose "Create Draft Invoices"
8. Click "Generate Invoice"

## What's Next?

### Integration with CareXPS

To integrate with your actual CareXPS cost calculation services:

1. Open `lib/services/billingCostService.ts`
2. Import your existing services:
```typescript
import { twilioCostService } from '@/services/twilioCostService'
import { chatService } from '@/services/chatService'
import { currencyService } from '@/services/currencyService'
```

3. Implement the cost calculation in `calculateCustomerCosts()`:
```typescript
// Query your chats
const chats = await chatService.getAllChats({
  start_timestamp: { gte: startTimestamp, lte: endTimestamp },
  chat_status: 'ended'
})

// Calculate costs using your existing service
for (const chat of chats) {
  const breakdown = twilioCostService.getDetailedCombinedBreakdown(
    chat.message_with_tool_calls || [],
    chat.chat_cost?.combined_cost ?? 0
  )
  twilioSMSCostCAD += breakdown.twilioSMSCostCAD
  retellAIChatCostCAD += breakdown.retellChatCostCAD
  totalSegments += breakdown.segmentCount
}
```

### Add MFA Protection

Before production, implement MFA middleware:

1. Create `middleware.ts` in the project root
2. Add MFA verification logic:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Check if accessing billing routes
  if (path.startsWith('/admin/billing')) {
    // Add your MFA verification logic here
    // Check user role, MFA status, etc.
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/billing/:path*'
}
```

### Production Checklist

Before deploying to production:

- [ ] Change Stripe to Live Mode in Settings
- [ ] Use live Stripe API keys (sk_live_...)
- [ ] Implement MFA middleware
- [ ] Set up proper user authentication
- [ ] Configure Row Level Security policies in Supabase
- [ ] Enable audit logging for all billing actions
- [ ] Test all invoice generation scenarios
- [ ] Set up Stripe webhooks for payment notifications
- [ ] Configure email notifications
- [ ] Review and test all security policies

## Troubleshooting

**"Cannot connect to Supabase"**
- Double-check your Supabase URL and anon key
- Make sure the keys don't have extra spaces or quotes
- Verify your Supabase project is active

**"Stripe connection test failed"**
- Verify you're using the correct key for test/live mode
- Test mode keys start with `sk_test_`
- Live mode keys start with `sk_live_`
- Check the key isn't expired or restricted

**"No tables found"**
- Run the database migration SQL script
- Check for errors in the SQL Editor
- Verify RLS policies are created

**"Invoice generation fails"**
- Make sure customer has a Stripe customer ID
- Check Stripe is initialized in Settings
- Verify you have permission to create invoices in Stripe

## Support

For additional help:
- Check the main [README.md](./README.md) for detailed documentation
- Review the [Database Setup Guide](./supabase/README.md)
- Consult the original [Billing Platform Prompt](https://github.com/...)

---

**You're all set!** Start adding customers and generating invoices. 🎉
