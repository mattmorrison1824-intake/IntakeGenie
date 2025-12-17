-- Add new telephony fields to firms table for Twilio + Vapi integration
-- This replaces the free Vapi number approach with purchased Twilio numbers imported into Vapi

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS inbound_number_e164 TEXT,
ADD COLUMN IF NOT EXISTS twilio_phone_number_sid TEXT,
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS telephony_provider TEXT DEFAULT NULL;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS idx_firms_twilio_phone_number_sid ON firms(twilio_phone_number_sid);
CREATE INDEX IF NOT EXISTS idx_firms_vapi_phone_number_id ON firms(vapi_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_firms_inbound_number_e164 ON firms(inbound_number_e164);

-- Add comments
COMMENT ON COLUMN firms.inbound_number_e164 IS 'E.164 formatted phone number (e.g., +15551234567)';
COMMENT ON COLUMN firms.twilio_phone_number_sid IS 'Twilio phone number SID (e.g., PN...)';
COMMENT ON COLUMN firms.vapi_phone_number_id IS 'Vapi phone number ID after importing from Twilio';
COMMENT ON COLUMN firms.telephony_provider IS 'Telephony provider type: twilio_imported_into_vapi, vapi_free, etc.';

