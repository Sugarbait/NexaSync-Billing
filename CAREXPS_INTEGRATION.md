# CareXPS CRM Integration Guide

## 🎯 Overview

This document outlines the complete integration of **CareXPS CRM** design patterns, services, and calculation logic into the **NexaSync Billing Platform**. The integration brings production-tested, healthcare-grade code into a professional billing system.

---

## ✅ Completed Integrations

### 1. **Design System Integration**

#### **Tailwind Configuration** (`tailwind.config.ts`)
- ✅ Professional healthcare color palette (primary, success, warning, danger)
- ✅ Custom typography (Roboto/Inter font stack)
- ✅ Healthcare-specific shadows and animations
- ✅ Dark mode support with class-based toggling
- ✅ Consistent design tokens across the platform

**Color Scheme:**
- Primary Blue: `#3b82f6` - Financial confidence and professionalism
- Success Green: `#10b981` - Payment confirmations and success states
- Warning Amber: `#f59e0b` - Pending invoices and alerts
- Danger Red: `#ef4444` - Overdue invoices and errors

---

### 2. **Core Services Integration**

#### **Retell AI Service** (`lib/services/retellService.ts`)
Comprehensive AI conversation data import with production-ready API integration.

**Features:**
- Complete Retell AI API v2 integration
- Call history fetching with advanced filtering
- Chat history retrieval with timestamp filtering
- Cost calculation and metrics aggregation
- Agent-specific data querying
- Error handling with graceful degradation

**Key Methods:**
```typescript
retellService.getCallsForAgents(agentIds, startTimestamp, endTimestamp)
retellService.getChatsForAgents(agentIds, startTimestamp, endTimestamp)
retellService.calculateCallMetrics(calls)
retellService.testConnection()
```

**Usage Example:**
```typescript
import { retellService } from '@/lib/services/retellService'

// Initialize with API key
retellService.initialize(apiKey)

// Fetch calls for billing period
const calls = await retellService.getCallsForAgents(
  ['agent_123', 'agent_456'],
  startTimestamp,
  endTimestamp
)

// Calculate metrics
const metrics = retellService.calculateCallMetrics(calls)
console.log(`Total cost: $${metrics.totalCost.toFixed(2)}`)
```

---

#### **Twilio Cost Service** (`lib/services/twilioCostService.ts`)
Production-tested SMS and voice cost calculations matching Twilio's billing exactly.

**Features:**
- Accurate SMS segment calculation (GSM-7 and UCS-2 encoding)
- Voice call cost calculation with per-minute rounding
- USD to CAD currency conversion
- Detailed cost breakdowns for analytics

**Pricing:**
- Voice: $0.022 USD per minute (Canadian toll-free inbound)
- SMS: $0.0083 USD per segment

**Key Methods:**
```typescript
twilioCostService.calculateInboundCallCost(callLengthSeconds)
twilioCostService.getTwilioCostCAD(callLengthSeconds)
twilioCostService.calculateSMSSegments(messageContent)
twilioCostService.calculateSMSCost(messages)
```

**Usage Example:**
```typescript
import { twilioCostService } from '@/lib/services/twilioCostService'

// Calculate voice call cost
const callCost = twilioCostService.getTwilioCostCAD(300) // 5 minutes
console.log(`Call cost: $${callCost.toFixed(2)} CAD`)

// Calculate SMS cost
const messages = [{ content: 'Hello, this is a message!' }]
const smsCost = twilioCostService.getSMSCostCAD(messages)
console.log(`SMS cost: $${smsCost.toFixed(2)} CAD`)
```

---

#### **Currency Service** (`lib/services/currencyService.ts`)
Live exchange rate management with caching and fallback support.

**Features:**
- Live USD to CAD conversion via exchange rate API
- 24-hour rate caching in localStorage
- Automatic fallback to fixed rate (1.35 CAD/USD)
- Manual rate refresh capability

**Key Methods:**
```typescript
currencyService.convertUSDToCAD(amountUSD)
currencyService.getCurrentRate()
currencyService.formatCAD(amount)
currencyService.forceUpdate() // Refresh exchange rate
```

---

#### **Enhanced Billing Cost Service** (`lib/services/billingCostService.ts`)
Integrated service combining all cost calculation logic.

**Enhancements:**
- Uses `twilioCostService` for accurate Twilio calculations
- Uses `currencyService` for live exchange rates
- Integrates with both Retell AI and Twilio services
- Provides comprehensive cost breakdowns

**Cost Breakdown Interface:**
```typescript
interface CostBreakdown {
  chatCount: number
  callCount: number
  totalSegments: number
  totalMinutes: number
  twilioSMSCostCAD: number
  twilioVoiceCostCAD: number
  retellAIChatCostCAD: number
  retellAIVoiceCostCAD: number
  subtotal: number
  markupAmount: number
  total: number
}
```

---

### 3. **UI Components Integration**

#### **DateRangePicker Component** (`components/common/DateRangePicker.tsx`)
Professional date range selector with CareXPS design.

**Features:**
- Preset ranges: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Year
- Custom date range with visual calendar inputs
- Timezone-aware date handling (fixes UTC offset issues)
- Responsive design with mobile optimization
- Dark mode support

**Helper Function:**
```typescript
getDateRangeFromSelection(range, customStart?, customEnd?)
```

Returns properly formatted start and end dates with correct timezone handling:
```typescript
const { start, end } = getDateRangeFromSelection('thisMonth')
// start: 2025-10-01 00:00:00
// end: 2025-10-31 23:59:59
```

**Usage Example:**
```tsx
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'

function InvoicePage() {
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth')
  const [customStart, setCustomStart] = useState<Date>()
  const [customEnd, setCustomEnd] = useState<Date>()

  const handleDateChange = (range: DateRange, start?: Date, end?: Date) => {
    setDateRange(range)
    if (range === 'custom') {
      setCustomStart(start)
      setCustomEnd(end)
    }
  }

  return (
    <DateRangePicker
      selectedRange={dateRange}
      onRangeChange={handleDateChange}
      customStartDate={customStart}
      customEndDate={customEnd}
    />
  )
}
```

---

#### **Analytics Charts Component** (`components/dashboard/AnalyticsCharts.tsx`)
CareXPS-style analytics with Recharts integration.

**Charts Included:**
1. **Revenue Trends Bar Chart** - Stacked bars showing Twilio SMS, Voice, and Retell AI costs
2. **Cost Distribution Pie Chart** - Percentage breakdown of current month costs
3. **Revenue Growth Line Chart** - Total revenue trend over time

**Features:**
- Responsive design adapts to screen sizes
- Custom tooltips with formatted currency
- CareXPS color scheme for consistency
- Dark mode compatible
- Smooth animations and transitions

**Usage Example:**
```tsx
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts'

function Dashboard() {
  const monthlyTrends = [
    { month: 'May', twilioSMS: 1200, twilioVoice: 800, retellAI: 1500, total: 3500 },
    { month: 'Jun', twilioSMS: 1400, twilioVoice: 900, retellAI: 1600, total: 3900 }
  ]

  const currentMonthBreakdown = {
    twilioSMS: 1700,
    twilioVoice: 1100,
    retellAI: 1900
  }

  return (
    <AnalyticsCharts
      monthlyTrends={monthlyTrends}
      currentMonthBreakdown={currentMonthBreakdown}
    />
  )
}
```

---

## 🚀 Implementation Guide

### **Step 1: Environment Setup**

Add these environment variables to `.env.local`:

```bash
# Retell AI Configuration
NEXT_PUBLIC_RETELL_API_KEY=your_retell_api_key

# Twilio Configuration (optional - for direct API access)
NEXT_PUBLIC_TWILIO_ACCOUNT_SID=your_twilio_sid
NEXT_PUBLIC_TWILIO_AUTH_TOKEN=your_twilio_token

# Currency API (optional - for live exchange rates)
NEXT_PUBLIC_EXCHANGE_RATE_API_KEY=your_api_key
```

### **Step 2: Initialize Services**

```typescript
// In your settings or initialization code
import { retellService } from '@/lib/services/retellService'
import { billingCostService } from '@/lib/services/billingCostService'

// Initialize Retell AI
retellService.initialize(process.env.NEXT_PUBLIC_RETELL_API_KEY!)

// Optional: Initialize Twilio for direct API access
await billingCostService.initializeServices(userId)
```

### **Step 3: Calculate Customer Costs**

```typescript
import { billingCostService } from '@/lib/services/billingCostService'
import { getDateRangeFromSelection } from '@/components/common/DateRangePicker'

async function generateInvoice(customerId: string) {
  // Get date range
  const { start, end } = getDateRangeFromSelection('thisMonth')

  // Calculate costs
  const breakdown = await billingCostService.calculateCustomerCosts(
    customerId,
    { start, end },
    userId
  )

  console.log('Cost Breakdown:', {
    chats: breakdown.chatCount,
    calls: breakdown.callCount,
    total: `$${breakdown.total.toFixed(2)} CAD`
  })
}
```

---

## 📊 Cost Calculation Flow

### **Multi-Source Cost Aggregation**

```
┌─────────────────────┐
│  Retell AI API      │
│  - Call costs       │
│  - Chat costs       │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │  Retell AI   │───┐
    │  Service     │   │
    └──────────────┘   │
                       │
┌─────────────────────┐│
│  Twilio API         ││
│  - SMS records      ││
│  - Voice records    ││
└──────────┬──────────┘│
           │           │
           ▼           │
    ┌──────────────┐  │
    │  Twilio Cost │  │
    │  Service     │──┤
    └──────────────┘  │
                      │
    ┌──────────────┐  │
    │  Currency    │  │
    │  Service     │──┤
    └──────────────┘  │
                      │
                      ▼
           ┌────────────────────┐
           │  Billing Cost      │
           │  Service           │
           │  (Aggregator)      │
           └─────────┬──────────┘
                     │
                     ▼
           ┌────────────────────┐
           │  Cost Breakdown    │
           │  - Twilio SMS      │
           │  - Twilio Voice    │
           │  - Retell AI Chat  │
           │  - Retell AI Voice │
           │  - Markup          │
           │  - Total (CAD)     │
           └────────────────────┘
```

---

## 🎨 Design Patterns from CareXPS

### **1. Gradient Text Headers**
```tsx
<h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
  Billing Dashboard
</h1>
```

### **2. Healthcare Shadows**
```tsx
<div className="shadow-healthcare rounded-lg">
  {/* Card content */}
</div>

<div className="shadow-healthcare-lg rounded-lg">
  {/* Large card content */}
</div>
```

### **3. Status Color Coding**
```typescript
const getStatusColor = (status: string) => {
  const colors = {
    draft: 'gray',
    sent: 'blue',
    paid: 'green',
    overdue: 'red',
    pending: 'yellow'
  }
  return colors[status] || 'gray'
}
```

### **4. Loading States**
```tsx
{loading ? (
  <div className="animate-pulse">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
  </div>
) : (
  <Content />
)}
```

---

## 🧪 Testing the Integration

### **1. Test Retell AI Service**

```typescript
import { retellService } from '@/lib/services/retellService'

// Test connection
const result = await retellService.testConnection()
console.log(result) // { success: true, message: 'Connected successfully' }

// Test data fetching
const calls = await retellService.getCallsForAgents(['agent_123'], 1696118400, 1698710400)
console.log(`Fetched ${calls.length} calls`)
```

### **2. Test Twilio Cost Calculations**

```typescript
import { twilioCostService } from '@/lib/services/twilioCostService'

// Test voice cost
const cost = twilioCostService.getTwilioCostCAD(300) // 5 minutes
console.assert(cost > 0, 'Voice cost should be calculated')

// Test SMS segmentation
const segments = twilioCostService.calculateSMSSegments('Hello! This is a test message.')
console.log(`Message uses ${segments} segment(s)`)
```

### **3. Test Currency Conversion**

```typescript
import { currencyService } from '@/lib/services/currencyService'

// Test conversion
const cad = currencyService.convertUSDToCAD(100)
console.log(`$100 USD = $${cad.toFixed(2)} CAD`)

// Check rate
console.log(`Current rate: ${currencyService.getCurrentRate()}`)
```

---

## 📦 File Structure

```
nexasync-billing/
├── app/
│   └── admin/billing/
│       └── invoices/generate/
│           └── page.tsx                   # Invoice generation wizard (enhanced)
├── components/
│   ├── common/
│   │   └── DateRangePicker.tsx            # ✅ NEW from CareXPS
│   ├── dashboard/
│   │   └── AnalyticsCharts.tsx            # ✅ NEW CareXPS-style charts
│   └── ui/                                # Existing UI components
├── lib/
│   └── services/
│       ├── retellService.ts               # ✅ NEW from CareXPS
│       ├── twilioCostService.ts           # ✅ NEW from CareXPS
│       ├── currencyService.ts             # ✅ NEW enhanced version
│       ├── billingCostService.ts          # ✅ ENHANCED with new services
│       └── twilioService.ts               # Existing Twilio API service
└── tailwind.config.ts                     # ✅ UPDATED with CareXPS theme
```

---

## 🎯 Next Steps

### **Immediate Enhancements:**

1. **Multi-Company Branding** - Add customer logos and color customization
2. **Email Automation** - Implement scheduled invoice delivery with templates
3. **Mobile Responsiveness** - Optimize for tablet and mobile devices
4. **Advanced Analytics** - Add customer profitability analysis
5. **Export Features** - PDF invoice generation with branded templates

### **Future Integrations:**

- Stripe payment links in invoices
- Automated dunning sequences for overdue invoices
- Customer self-service portal
- Advanced reporting dashboards
- Integration with accounting software (QuickBooks, Xero)

---

## 📝 Notes

- All CareXPS code has been adapted for Next.js 15 App Router
- Services are client-side compatible ('use client' where needed)
- Dark mode support maintained throughout
- TypeScript strict mode enabled for type safety
- Production-ready error handling and logging

---

## 🔗 References

- **CareXPS CRM Source:** `I:\Apps Back Up\CareXPS CRM\`
- **Design Prompt:** `BILLING_PLATFORM_PROMPT.md`
- **Retell AI Docs:** https://docs.retellai.com
- **Twilio Pricing:** https://www.twilio.com/pricing

---

**Integration completed successfully! 🎉**

*All core services, UI components, and calculation logic from CareXPS CRM have been successfully integrated into the NexaSync Billing Platform.*
