# Deprecated Database Fields Summary

This document lists all database fields that are no longer needed after recent changes to the IntakeGenie platform.

## Changes Made

1. **Removed Business Hours & Routing Rules** - System is now always on
2. **Removed Call Forwarding** - Users handle forwarding on their end
3. **Updated Phone Number Storage** - New unified phone number fields
4. **Removed Route Reason** - All calls handled the same way

## Deprecated Fields in `firms` Table

### Business Hours & Routing (Removed)
- ❌ `forward_to_number` - Users now handle forwarding themselves
- ❌ `mode` - System is always on (no routing modes)
- ❌ `open_days` - System is always on
- ❌ `open_time` - System is always on
- ❌ `close_time` - System is always on
- ❌ `failover_ring_seconds` - No routing rules

### Old Phone Number Fields (Replaced)
- ❌ `twilio_number` - Replaced by `inbound_number_e164`
- ❌ `vapi_phone_number` - Replaced by `inbound_number_e164`

### New Phone Number Fields (Active)
- ✅ `inbound_number_e164` - Primary phone number (E.164 format)
- ✅ `twilio_phone_number_sid` - Twilio phone number SID
- ✅ `vapi_phone_number_id` - Vapi phone number ID (for API lookups)
- ✅ `telephony_provider` - Provider type (e.g., 'twilio_imported_into_vapi')

## Deprecated Fields in `calls` Table

### Routing (Removed)
- ❌ `route_reason` - No routing rules, all calls handled the same
  - **Note**: Still displayed in UI but always 'after_hours' for Vapi calls
  - **Action Required**: Remove from UI components:
    - `components/CallsList.tsx` (lines 105-106)
    - `components/CallTranscript.tsx` (line 326)
    - `components/CallDetail.tsx` (line 59)
    - `types/index.ts` (RouteReason type)

## Fields Kept for Backward Compatibility

- ✅ `twilio_call_sid` in `calls` - For old call records
- ✅ `vapi_phone_number_id` in `firms` - Still used for API lookups

## Active Fields in `firms` Table

### Core Fields
- `id`, `owner_user_id`, `firm_name`, `timezone`, `notify_emails`, `created_at`

### Phone Number Fields
- `inbound_number_e164`, `twilio_phone_number_sid`, `vapi_phone_number_id`, `telephony_provider`

### Stripe Subscription Fields
- `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`
- `subscription_status`, `subscription_plan`
- `subscription_current_period_end`, `subscription_cancel_at_period_end`

### AI Settings Fields
- `ai_greeting_custom`, `ai_tone`, `ai_knowledge_base`

### Vapi Integration Fields
- `vapi_assistant_id`

## Active Fields in `calls` Table

### Core Fields
- `id`, `firm_id`, `started_at`, `ended_at`, `status`, `urgency`

### Phone Number Fields
- `from_number`, `to_number`

### Call Identifiers
- `twilio_call_sid` (backward compatibility)
- `vapi_conversation_id` (primary for Vapi calls)

### Call Data
- `recording_url`, `transcript_text`, `intake_json`, `summary_json`
- `call_category` (new field for call type)
- `error_message`

## Migration Steps

1. **Run SQL Migration**: Execute `sql/remove_deprecated_fields.sql` in Supabase SQL Editor
2. **Update TypeScript Types**: Remove deprecated fields from `types/index.ts` and `types/database.ts`
3. **Update UI Components**: Remove references to `route_reason` in:
   - `components/CallsList.tsx`
   - `components/CallTranscript.tsx`
   - `components/CallDetail.tsx`
4. **Update API Routes**: Remove any code that references deprecated fields
5. **Test**: Verify all functionality works after migration

## Files That Reference Deprecated Fields

### `route_reason` (needs removal from UI):
- `components/CallsList.tsx` - Used in `getCategory()` function
- `components/CallTranscript.tsx` - Displayed in call details
- `components/CallDetail.tsx` - Displayed in call details
- `lib/intake/processor.ts` - Set to 'after_hours' for Vapi calls
- `app/api/twilio/failover/route.ts` - Set to 'no_answer' (old Twilio route)

### Old phone number fields (already handled with fallbacks):
- `components/SettingsForm.tsx` - Has fallback logic
- `components/PhoneNumberProvision.tsx` - Has fallback logic
- `app/api/twilio/set-number/route.ts` - Old route (can be removed)
- `app/api/twilio/purchase-number/route.ts` - Old route (can be removed)

## Recommendation

1. **Safe to Remove Now**: All business hours and routing fields in `firms` table
2. **Safe to Remove Now**: Old phone number fields (`twilio_number`, `vapi_phone_number`)
3. **Remove After UI Update**: `route_reason` in `calls` table (after updating UI components)

