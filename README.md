# NexaSync Billing Platform

A comprehensive billing administration platform built with Next.js, designed for managing customer billing, generating invoices via Stripe, and tracking revenue metrics.

## 🔒 Security Features

> ⚠️ **IMPORTANT**: See [SECURITY.md](./SECURITY.md) for security-critical files that require authorization to modify.

- **MFA Required**: Multi-factor authentication mandatory for all access
- **Super User Only**: Access restricted to Super User role
- **No PHI/HIPAA Data**: Handles only billing and usage data (costs, call counts, SMS segments)
- **Row Level Security**: Database-level access control via Supabase RLS
- **Encrypted Storage**: Stripe API keys encrypted at rest
- **Protected Code**: Security-critical files are marked and require authorization (see [SECURITY.md](./SECURITY.md))

## ✨ Features

### Dashboard
- Current month revenue tracking (MTD)
- Previous month revenue comparison
- Customer count and pending invoices overview
- Monthly revenue trends chart (last 6 months)
- Recent invoice activity feed

### Customer Management
- Add, edit, and delete billing customers
- Stripe customer integration
- Configurable markup percentages per customer
- Auto-invoice settings
- Search and filter capabilities
- CSV export

### Invoice Generation
- Multi-step invoice wizard
- Date range selection (previous month, current month, custom)
- Cost preview with breakdown
- Batch invoice creation
- Stripe integration (draft, finalize, or send)
- Automatic Stripe customer creation
- Progress tracking

### Invoice History
- View all invoices with filtering
- Filter by status (draft, sent, paid, overdue, cancelled)
- Search by invoice number or customer
- Invoice detail modal with cost breakdown
- Send invoices directly
- Mark invoices as paid
- CSV export

### Settings
- Stripe API configuration
- Connection testing
- Invoice defaults (markup, payment terms, notes)
- Email notifications
- Test/Live mode toggle

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Stripe account (test or live)

### Installation

1. **Clone and install dependencies**:
```bash
cd nexasync-billing
npm install
```

2. **Configure environment variables**:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
```

3. **Set up the database**:

Go to your Supabase SQL Editor and run the migration:
```bash
supabase/migrations/20251001000001_create_billing_tables.sql
```

Or see `supabase/README.md` for detailed instructions.

4. **Run the development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
nexasync-billing/
├── app/
│   ├── admin/billing/          # Billing routes
│   │   ├── page.tsx            # Dashboard
│   │   ├── layout.tsx          # Billing layout with nav
│   │   ├── customers/          # Customer management
│   │   ├── invoices/           # Invoice pages
│   │   │   ├── page.tsx        # Invoice history
│   │   │   └── generate/       # Invoice wizard
│   │   └── settings/           # Settings page
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home (redirects to billing)
├── components/
│   ├── ui/                     # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── Badge.tsx
│   └── billing/                # Billing-specific components
├── lib/
│   ├── services/               # Business logic
│   │   ├── stripeInvoiceService.ts
│   │   └── billingCostService.ts
│   ├── types/                  # TypeScript types
│   │   └── billing.ts
│   ├── utils/                  # Utility functions
│   │   ├── format.ts
│   │   └── validation.ts
│   └── supabase.ts             # Supabase client
├── supabase/
│   ├── migrations/             # Database migrations
│   └── README.md               # Database setup guide
└── public/                     # Static assets
```

## 🗄️ Database Schema

### Tables

1. **billing_customers**
   - Stores customer information (business names, emails, contact info)
   - Stripe customer ID linkage
   - Markup percentage configuration
   - NO PHI data

2. **invoice_records**
   - Invoice metadata and status
   - Usage metrics (chats, calls, segments, minutes)
   - Cost breakdown (Twilio SMS, Voice, Retell AI)
   - Stripe invoice links

3. **billing_settings**
   - Per-user Stripe configuration
   - Invoice defaults
   - Notification preferences

### Security

All tables use Row Level Security (RLS) with policies requiring:
- Valid authentication
- Super User role
- MFA enabled and setup completed

## 🔌 Integration Points

### Stripe

The platform integrates with Stripe for invoice generation:
- Customer creation and management
- Invoice creation with line items
- Invoice finalization and sending
- Payment tracking

### Cost Calculation

Currently uses a simplified cost calculation service. To integrate with actual CareXPS services:

1. Update `lib/services/billingCostService.ts`
2. Import your existing cost services:
   - `twilioCostService` for SMS and voice costs
   - `currencyService` for USD to CAD conversion
   - Chat and call data services
3. Implement the cost calculation logic using your existing methods

Example integration:
```typescript
import { twilioCostService } from '@/services/twilioCostService'
import { chatService } from '@/services/chatService'

// In calculateCustomerCosts():
const chats = await chatService.getAllChats({
  start_timestamp: { gte: startTimestamp, lte: endTimestamp },
  chat_status: 'ended'
})

for (const chat of chats) {
  const breakdown = twilioCostService.getDetailedCombinedBreakdown(
    chat.message_with_tool_calls || [],
    chat.chat_cost?.combined_cost ?? 0
  )
  twilioSMSCostCAD += breakdown.twilioSMSCostCAD
  // ...
}
```

## 🛠️ Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## 📋 TODO / Future Enhancements

### Phase 2 (Future)
- [ ] Stripe webhook integration for automatic payment status updates
- [ ] Automated monthly invoice generation (scheduled jobs)
- [ ] Email notifications
- [ ] Advanced filtering and search
- [ ] Customer portal (self-service billing)
- [ ] Multi-currency support
- [ ] Subscription-based billing
- [ ] Revenue forecasting and analytics
- [ ] Integration with accounting software (QuickBooks, Xero)

## 🔐 Security Best Practices

> ⚠️ **CRITICAL**: Security-critical files require authorization before modification. See [SECURITY.md](./SECURITY.md) for complete list and policies.

1. **Never commit `.env.local`** - Contains sensitive credentials
2. **Use test mode** for development and testing
3. **Stripe keys** - Secret keys are encrypted in the database, never in environment variables
4. **MFA enforcement** - Implement MFA middleware before production deployment
5. **Audit logging** - All billing actions should be logged (already structured in database migrations)
6. **No PHI** - This platform handles NO protected health information
7. **Protected Code** - Files marked with "SECURITY CRITICAL" require authorization from elitesquadp@protonmail.com

## 🆘 Troubleshooting

### Common Issues

**Database connection errors**:
- Verify Supabase URL and anon key in `.env.local`
- Check RLS policies are set up correctly
- Ensure user has Super User role and MFA enabled

**Stripe connection fails**:
- Verify API keys in Settings page
- Test connection using the "Test Connection" button
- Check test/live mode matches your keys

**Invoices not generating**:
- Ensure customers have Stripe customer IDs
- Check cost calculation service is returning data
- Verify Stripe is initialized before generating invoices

## 📝 License

Proprietary - NexaSync/CareXPS

## 🤝 Support

For issues or questions, contact the development team.

---

**Built with**:
- [Next.js 15](https://nextjs.org/)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/)
- [Stripe](https://stripe.com/)
- [Recharts](https://recharts.org/)
