-- Add Vonage phone numbers tracking to billing_customers
ALTER TABLE billing_customers
ADD COLUMN IF NOT EXISTS vonage_phone_numbers TEXT[] DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN billing_customers.vonage_phone_numbers IS 'Array of Vonage phone numbers to track usage and costs for this customer';
