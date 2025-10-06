-- Add Vonage cost column to invoice_records table
ALTER TABLE invoice_records
ADD COLUMN IF NOT EXISTS vonage_cost_cad NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- Add comment to the column
COMMENT ON COLUMN invoice_records.vonage_cost_cad IS 'Vonage SMS/Voice cost in CAD';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'invoice_records'
AND column_name = 'vonage_cost_cad';
