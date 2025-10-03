-- Add Twilio API configuration to billing_settings

ALTER TABLE billing_settings
ADD COLUMN twilio_account_sid_encrypted TEXT,
ADD COLUMN twilio_auth_token_encrypted TEXT,
ADD COLUMN twilio_api_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN billing_settings.twilio_account_sid_encrypted IS
'Encrypted Twilio Account SID for fetching usage data and costs';

COMMENT ON COLUMN billing_settings.twilio_auth_token_encrypted IS
'Encrypted Twilio Auth Token for API authentication';

COMMENT ON COLUMN billing_settings.twilio_api_enabled IS
'Whether to use Twilio API for cost calculations (vs manual import)';
