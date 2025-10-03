-- Add Retell API key column to billing_customers table
-- This allows each customer to have their own Retell AI API key

ALTER TABLE billing_customers
ADD COLUMN retell_api_key_encrypted TEXT;

-- Add comment for documentation
COMMENT ON COLUMN billing_customers.retell_api_key_encrypted IS
'Encrypted Retell AI API key specific to this customer. Used to fetch their call/chat data and costs.';

-- Create index for customers with API keys enabled
CREATE INDEX idx_billing_customers_has_retell_key ON billing_customers ((retell_api_key_encrypted IS NOT NULL));
