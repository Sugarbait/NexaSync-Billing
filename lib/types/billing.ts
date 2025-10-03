// Database Types
export interface BillingCustomer {
  id: string
  customer_name: string
  customer_email: string
  stripe_customer_id: string | null
  retell_agent_ids: string[]
  retell_api_key_encrypted: string | null
  markup_percentage: number
  auto_invoice_enabled: boolean
  billing_contact_name: string | null
  billing_address: string | null
  phone_number: string | null
  tax_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  notes: string | null
}

export interface InvoiceRecord {
  id: string
  billing_customer_id: string
  stripe_invoice_id: string | null
  invoice_number: string | null
  billing_period_start: string
  billing_period_end: string
  total_chats: number
  total_calls: number
  total_sms_segments: number
  total_call_minutes: number
  twilio_sms_cost_cad: number
  twilio_voice_cost_cad: number
  retell_ai_chat_cost_cad: number
  retell_ai_voice_cost_cad: number
  subtotal_cad: number
  markup_amount_cad: number
  total_amount_cad: number
  invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  stripe_invoice_url: string | null
  stripe_invoice_pdf_url: string | null
  created_at: string
  sent_at: string | null
  paid_at: string | null
  due_date: string | null
  created_by: string | null
}

export interface BillingSettings {
  id: string
  user_id: string
  stripe_api_key_encrypted: string | null
  stripe_publishable_key: string | null
  stripe_test_mode: boolean
  retell_api_key_encrypted: string | null
  retell_api_enabled: boolean
  twilio_account_sid_encrypted: string | null
  twilio_auth_token_encrypted: string | null
  twilio_api_enabled: boolean
  default_markup_percentage: number
  default_due_date_days: number
  default_invoice_note: string | null
  invoice_footer_text: string | null
  auto_invoice_enabled: boolean
  auto_invoice_day_of_month: number
  auto_invoice_time: string
  auto_send_invoices: boolean
  notification_email: string | null
  notify_on_invoice_generated: boolean
  notify_on_payment_received: boolean
  created_at: string
  updated_at: string
}

// UI Types
export interface InvoicePreview {
  customerId: string
  customerName: string
  totalChats: number
  totalCalls: number
  totalSegments: number
  totalMinutes: number
  twilioSMSCost: number
  twilioVoiceCost: number
  retellAICost: number
  subtotal: number
  markupPercent: number
  markupAmount: number
  total: number
  hasStripeCustomer: boolean
  includeInBatch: boolean
}

export interface InvoiceResult {
  success: boolean
  customerId: string
  customerName: string
  invoiceId?: string
  invoiceRecordId?: string
  amount?: number
  error?: string
}

export interface InvoiceOptions {
  mode: 'draft' | 'finalize' | 'send'
  dueInDays: number
  autoCreateStripeCustomers: boolean
  skipMissingCustomers: boolean
}

export interface CostBreakdown {
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

export interface MonthlyTrend {
  month: string
  twilioSMS: number
  twilioVoice: number
  retellAI: number
  total: number
}
