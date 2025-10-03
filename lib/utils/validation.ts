import { z } from 'zod'

// Customer validation schema
export const customerSchema = z.object({
  customer_name: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name too long'),

  customer_email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long'),

  billing_contact_name: z.string()
    .max(100, 'Contact name too long')
    .optional(),

  phone_number: z.string()
    .regex(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),

  billing_address: z.string()
    .max(500, 'Address too long')
    .optional(),

  tax_id: z.string()
    .max(50, 'Tax ID too long')
    .optional(),

  markup_percentage: z.number()
    .min(0, 'Markup cannot be negative')
    .max(10000, 'Markup too high'),

  auto_invoice_enabled: z.boolean(),

  notes: z.string()
    .max(1000, 'Notes too long')
    .optional()
})

// Invoice generation validation
export const invoiceGenerationSchema = z.object({
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).refine(
    data => data.end >= data.start,
    'End date must be after start date'
  ),

  customers: z.array(z.string().uuid())
    .min(1, 'Select at least one customer'),

  mode: z.enum(['draft', 'finalize', 'send']),

  dueInDays: z.number()
    .int()
    .min(0, 'Due days cannot be negative')
    .max(365, 'Due days too far in future'),

  autoCreateStripeCustomers: z.boolean()
})

// Billing settings validation
export const billingSettingsSchema = z.object({
  stripe_api_key: z.string().optional(),
  stripe_publishable_key: z.string().optional(),
  stripe_test_mode: z.boolean(),
  default_markup_percentage: z.number().min(0).max(10000),
  default_due_date_days: z.number().int().min(1).max(365),
  default_invoice_note: z.string().max(1000).optional(),
  invoice_footer_text: z.string().max(500).optional(),
  notification_email: z.string().email().optional()
})

export type CustomerFormData = z.infer<typeof customerSchema>
export type InvoiceGenerationData = z.infer<typeof invoiceGenerationSchema>
export type BillingSettingsData = z.infer<typeof billingSettingsSchema>
