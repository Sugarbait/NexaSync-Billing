-- Add Retell API configuration to billing_settings

ALTER TABLE billing_settings
ADD COLUMN retell_api_key_encrypted TEXT,
ADD COLUMN retell_api_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN billing_settings.retell_api_key_encrypted IS
'Encrypted Retell AI API key for fetching call/chat data and costs';

COMMENT ON COLUMN billing_settings.retell_api_enabled IS
'Whether to use Retell AI API for cost calculations (vs manual import)';
