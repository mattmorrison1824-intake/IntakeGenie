import { createServiceClient } from '@/lib/clients/supabase';
import { getPlanLimit } from '@/lib/constants/plans';
import type { PlanName } from '@/lib/constants/plans';

/**
 * Get current billing period usage in minutes for a firm
 */
export async function getCurrentPeriodUsage(firmId: string): Promise<number> {
  const supabase = createServiceClient();
  
  // @ts-ignore - Custom RPC function not in generated types
  const { data, error } = await supabase.rpc('get_current_period_usage_minutes', {
    p_firm_id: firmId,
  });

  if (error) {
    console.error('[Usage] Error getting current period usage:', error);
    return 0;
  }

  return Number(data) || 0;
}

/**
 * Get usage for a specific time period
 */
export async function getUsageForPeriod(
  firmId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const supabase = createServiceClient();
  
  // @ts-ignore - Custom RPC function not in generated types
  const { data, error } = await supabase.rpc('get_firm_usage_minutes', {
    p_firm_id: firmId,
    p_period_start: periodStart.toISOString(),
    p_period_end: periodEnd.toISOString(),
  });

  if (error) {
    console.error('[Usage] Error getting usage for period:', error);
    return 0;
  }

  return Number(data) || 0;
}

/**
 * Check if firm has exceeded their plan limit
 */
export async function checkUsageLimit(
  firmId: string,
  plan: PlanName | null
): Promise<{ withinLimit: boolean; used: number; limit: number; remaining: number }> {
  if (!plan) {
    // No plan = no limit (or handle as needed)
    return {
      withinLimit: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
    };
  }

  const limit = getPlanLimit(plan);
  const used = await getCurrentPeriodUsage(firmId);
  const remaining = Math.max(0, limit - used);

  return {
    withinLimit: used < limit,
    used,
    limit,
    remaining,
  };
}

/**
 * Check if a new call would exceed the limit
 * Returns true if call should be allowed, false if limit exceeded
 */
export async function canMakeCall(
  firmId: string,
  plan: PlanName | null,
  estimatedMinutes: number = 2 // Default estimate: 2 minutes per call
): Promise<{ allowed: boolean; reason?: string; used: number; limit: number; remaining: number }> {
  if (!plan) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
    };
  }

  const usage = await checkUsageLimit(firmId, plan);
  
  if (usage.remaining < estimatedMinutes) {
    return {
      allowed: false,
      reason: `You have reached your plan limit of ${usage.limit} minutes. Please upgrade your plan to continue receiving calls.`,
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
    };
  }

  return {
    allowed: true,
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
  };
}

