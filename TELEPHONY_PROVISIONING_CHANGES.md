# Telephony Provisioning Changes Summary

## Overview
Replaced free Vapi number provisioning with Twilio number purchase + Vapi import for reliable, immediate number assignment.

## Files Changed

### 1. Database Migration
- **File**: `sql/add_telephony_fields.sql`
- **Changes**: Added new columns to `firms` table:
  - `inbound_number_e164` - E.164 formatted phone number
  - `twilio_phone_number_sid` - Twilio phone number SID
  - `vapi_phone_number_id` - Vapi phone number ID after import
  - `telephony_provider` - Provider type (e.g., 'twilio_imported_into_vapi')

### 2. Vapi Utilities
- **File**: `lib/vapi/utils.ts` (NEW)
- **Changes**: Added `cleanVapiPayload()` function to strip undefined/null values from objects before PATCH requests

### 3. New Provisioning Route
- **File**: `app/api/telephony/provision/route.ts` (NEW)
- **Changes**: 
  - Purchases Twilio phone number
  - Imports Twilio number into Vapi
  - Assigns Vapi assistant to imported number
  - Saves all details to database
  - Supports optional area code parameter

### 4. Refresh Route
- **File**: `app/api/telephony/refresh-number/route.ts` (NEW)
- **Changes**: Fetches latest phone number details from Vapi and updates firm record

### 5. Updated Vapi Routes
- **File**: `app/api/vapi/update-assistant/route.ts`
  - Uses `cleanVapiPayload()` for PATCH requests
- **File**: `app/api/vapi/link-number/route.ts`
  - Uses `cleanVapiPayload()` for PATCH requests
- **File**: `app/api/vapi/provision-number/route.ts`
  - Disabled - returns error directing users to new endpoint

### 6. UI Updates
- **File**: `components/SettingsForm.tsx`
- **Changes**:
  - Added area code input field
  - Updated to use `/api/telephony/provision` endpoint
  - Displays `inbound_number_e164` with copy button
  - Shows provider type
  - Refresh button uses new `/api/telephony/refresh-number` endpoint

### 7. Type Definitions
- **File**: `types/index.ts`
- **Changes**: Added new fields to `Firm` interface:
  - `inbound_number_e164`
  - `twilio_phone_number_sid`
  - `telephony_provider`

## Testing Steps

1. **Run Database Migration**
   ```sql
   -- Execute sql/add_telephony_fields.sql in your Supabase SQL editor
   ```

2. **Test Provisioning**
   - Go to Settings page
   - Click "Provision Phone Number"
   - Optionally enter an area code (e.g., "415")
   - Verify number appears immediately
   - Test copy-to-clipboard button

3. **Test Refresh**
   - If number isn't showing, click "Refresh Number from Vapi"
   - Verify number updates

4. **Test Call Handling**
   - Call the provisioned number
   - Verify Vapi receives the call
   - Verify call appears in Calls section
   - Verify transcript and recording are saved

## Key Improvements

1. **Immediate Number Assignment**: Twilio numbers are available immediately, no async waiting
2. **Reliable Provisioning**: No more "Number being assigned..." stuck states
3. **Better Error Handling**: Clear error messages at each step
4. **Production Ready**: Suitable for SaaS with real law firms
5. **Clean API Calls**: PATCH requests only send defined fields, avoiding validation errors

## Notes

- Free Vapi number provisioning is disabled for production
- Old `vapi_phone_number` field is kept for migration compatibility
- Twilio credentials must be configured in environment variables
- Vapi import uses `provider: 'byo-phone-number'` with Twilio credentials

