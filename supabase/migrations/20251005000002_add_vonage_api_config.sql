-- Add Vonage API configuration to billing_settings
ALTER TABLE billing_settings
ADD COLUMN IF NOT EXISTS vonage_api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS vonage_api_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS vonage_api_enabled BOOLEAN DEFAULT false;

-- Add comment to explain the columns
COMMENT ON COLUMN billing_settings.vonage_api_key_encrypted IS 'Encrypted Vonage API Key for SMS and Voice services';
COMMENT ON COLUMN billing_settings.vonage_api_secret_encrypted IS 'Encrypted Vonage API Secret for authentication';
COMMENT ON COLUMN billing_settings.vonage_api_enabled IS 'Whether Vonage API integration is enabled for cost tracking';
