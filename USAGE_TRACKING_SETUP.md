# Usage Tracking and Plan Enforcement Setup

## Overview
This document explains how to set up usage tracking and plan limit enforcement for IntakeGenie.

## Stripe Product Catalog

**No changes needed!** The free trial is configured at the subscription level when creating the checkout session. The code already handles this with:
- `trial_period_days: 14` for starter plan
- `payment_method_collection: 'if_required'` (no credit card required for trial)

Your Stripe products can remain as-is. The trial period is applied when the subscription is created, not at the product level.

## SQL Migrations Required

### 1. Run Usage Tracking Migration

Run the following SQL in your Supabase SQL Editor:

```sql
-- File: sql/add_usage_tracking.sql
```

This migration:
- Adds `call_duration_minutes` column to `calls` table
- Creates functions to calculate call duration
- Creates functions to get usage for billing periods
- Creates a trigger to automatically calculate duration when calls end
- Backfills duration for existing calls

### 2. What the Migration Does

1. **Adds `call_duration_minutes` column**: Stores calculated duration for each call
2. **Creates helper functions**:
   - `calculate_call_duration_minutes()`: Calculates duration from timestamps
   - `get_firm_usage_minutes()`: Gets usage for a specific time period
   - `get_current_period_usage_minutes()`: Gets current billing period usage
3. **Creates trigger**: Automatically calculates duration when `ended_at` is set
4. **Backfills data**: Updates existing calls with calculated durations

## Usage Enforcement

The system now enforces plan limits:

1. **Before creating a new call**: Checks if the firm has remaining minutes
2. **Blocks calls if limit exceeded**: Returns an error if usage limit is reached
3. **Allows trial/active subscriptions**: Only blocks if subscription is not active

### How It Works

1. When a new call starts (webhook received), the system:
   - Checks if this is a new call (not an update to existing)
   - Gets the firm's subscription plan and status
   - Calculates current period usage
   - Compares against plan limit
   - Blocks call if limit exceeded

2. Usage is calculated from:
   - `started_at` and `ended_at` timestamps
   - Automatically stored in `call_duration_minutes`
   - Aggregated per billing period

## Plan Limits (Hardcoded)

Defined in `lib/constants/plans.ts`:
- **Starter**: 60 minutes/month (~30 calls)
- **Professional**: 200 minutes/month (~100 calls)
- **Turbo**: 1000 minutes/month (~500 calls)

## Usage Functions

### JavaScript/TypeScript

```typescript
import { getCurrentPeriodUsage, checkUsageLimit, canMakeCall } from '@/lib/utils/usage';

// Get current usage
const usage = await getCurrentPeriodUsage(firmId);

// Check if within limit
const limitCheck = await checkUsageLimit(firmId, 'starter');

// Check if can make a call
const canCall = await canMakeCall(firmId, 'starter', 2); // 2 min estimate
```

### SQL Functions

```sql
-- Get current period usage
SELECT get_current_period_usage_minutes('firm-uuid-here');

-- Get usage for specific period
SELECT get_firm_usage_minutes(
  'firm-uuid-here',
  '2024-01-01'::timestamp,
  '2024-02-01'::timestamp
);
```

## Testing

After running the migration:

1. **Check existing calls have duration**:
   ```sql
   SELECT id, started_at, ended_at, call_duration_minutes 
   FROM calls 
   WHERE ended_at IS NOT NULL 
   LIMIT 10;
   ```

2. **Test usage calculation**:
   ```sql
   SELECT get_current_period_usage_minutes('your-firm-id');
   ```

3. **Verify trigger works**: Update a call's `ended_at` and check if `call_duration_minutes` is calculated automatically

## Important Notes

1. **Billing Period**: Usage is calculated based on `subscription_current_period_end` from the `firms` table. If not set, it defaults to the current calendar month.

2. **Trial Periods**: During trial, usage is still tracked but limits are enforced. Make sure trial users understand their limits.

3. **Ongoing Calls**: Calls without `ended_at` won't have duration calculated until they end.

4. **Performance**: The usage functions use indexes for efficient queries. The `idx_calls_firm_id_started_at` index helps with period-based queries.

## Next Steps

1. ✅ Run `sql/add_usage_tracking.sql` in Supabase
2. ✅ Verify existing calls get duration backfilled
3. ✅ Test usage calculation functions
4. ✅ Monitor webhook logs for usage limit blocks
5. ✅ Consider adding usage dashboard in the platform UI

