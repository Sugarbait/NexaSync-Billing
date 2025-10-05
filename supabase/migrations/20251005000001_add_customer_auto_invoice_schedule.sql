-- Add per-customer auto-invoice scheduling columns
ALTER TABLE billing_customers
ADD COLUMN IF NOT EXISTS auto_invoice_day_of_month INTEGER,
ADD COLUMN IF NOT EXISTS auto_invoice_time TEXT,
ADD COLUMN IF NOT EXISTS auto_send_invoice BOOLEAN DEFAULT false;

-- Set default values for existing records
UPDATE billing_customers
SET auto_invoice_day_of_month = 1,
    auto_invoice_time = '09:00',
    auto_send_invoice = false
WHERE auto_invoice_day_of_month IS NULL;

-- Add constraint to validate day of month (1-28)
ALTER TABLE billing_customers
ADD CONSTRAINT valid_auto_invoice_day
CHECK (auto_invoice_day_of_month IS NULL OR (auto_invoice_day_of_month >= 1 AND auto_invoice_day_of_month <= 28));

-- Add comment to explain the columns
COMMENT ON COLUMN billing_customers.auto_invoice_day_of_month IS 'Day of month (1-28) when invoices should be auto-generated for this customer';
COMMENT ON COLUMN billing_customers.auto_invoice_time IS 'Time (HH:MM in 24h format) when invoices should be auto-generated';
COMMENT ON COLUMN billing_customers.auto_send_invoice IS 'Whether to automatically send invoices or create as draft';
