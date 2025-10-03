-- Add Retell Agent IDs to billing_customers table
-- Each customer can have multiple agent IDs (for different agents/phone numbers)

ALTER TABLE billing_customers
ADD COLUMN retell_agent_ids TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN billing_customers.retell_agent_ids IS
'Array of Retell AI agent IDs associated with this customer. Used to filter chats/calls for billing calculations.';

-- Create index for faster lookups when filtering by agent ID
CREATE INDEX idx_billing_customers_retell_agent_ids ON billing_customers USING GIN (retell_agent_ids);
