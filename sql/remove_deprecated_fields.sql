-- Remove deprecated fields from firms and calls tables
-- These fields are no longer used after removing business hours, routing rules, and old phone number fields

-- ============================================
-- FIRMS TABLE - Remove Deprecated Fields
-- ============================================

-- Remove business hours and routing fields (system is always on now)
ALTER TABLE firms
DROP COLUMN IF EXISTS forward_to_number,
DROP COLUMN IF EXISTS mode,
DROP COLUMN IF EXISTS open_days,
DROP COLUMN IF EXISTS open_time,
DROP COLUMN IF EXISTS close_time,
DROP COLUMN IF EXISTS failover_ring_seconds;

-- Remove old phone number fields (replaced by inbound_number_e164)
ALTER TABLE firms
DROP COLUMN IF EXISTS twilio_number,
DROP COLUMN IF EXISTS vapi_phone_number;

-- Note: Keep vapi_phone_number_id as it's still used for API lookups
-- Note: inbound_number_e164 is the new primary phone number field

-- ============================================
-- CALLS TABLE - Remove Deprecated Fields
-- ============================================

-- Remove route_reason field (no longer needed since we removed routing rules)
-- All calls are now handled the same way, so this field is redundant
ALTER TABLE calls
DROP COLUMN IF EXISTS route_reason;

-- Note: twilio_call_sid is kept for backward compatibility with old calls
-- Note: vapi_conversation_id is the new primary identifier for Vapi calls

-- ============================================
-- Clean up indexes (if they exist)
-- ============================================

-- Remove indexes for deprecated fields
DROP INDEX IF EXISTS idx_firms_twilio_number;
DROP INDEX IF EXISTS idx_firms_vapi_phone_number;

-- ============================================
-- Summary of Changes
-- ============================================
-- 
-- Removed from firms:
--   - forward_to_number (users handle forwarding)
--   - mode (system is always on)
--   - open_days (system is always on)
--   - open_time (system is always on)
--   - close_time (system is always on)
--   - failover_ring_seconds (no routing rules)
--   - twilio_number (replaced by inbound_number_e164)
--   - vapi_phone_number (replaced by inbound_number_e164)
--
-- Removed from calls:
--   - route_reason (no routing rules, all calls handled the same)
--     NOTE: Update UI components to remove route_reason references:
--     - components/CallsList.tsx (line 105-106)
--     - components/CallTranscript.tsx (line 326)
--     - components/CallDetail.tsx (line 59)
--     - types/index.ts (RouteReason type and route_reason field)
--
-- Fields kept for backward compatibility:
--   - twilio_call_sid in calls (for old call records)
--   - vapi_phone_number_id in firms (still used for API lookups)
--
-- Active fields in firms:
--   - inbound_number_e164 (primary phone number)
--   - twilio_phone_number_sid (Twilio SID)
--   - vapi_phone_number_id (Vapi phone number ID)
--   - telephony_provider (provider type)
--   - All Stripe subscription fields
--   - All AI settings fields

