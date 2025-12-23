-- Add usage tracking for plan limits
-- This enables tracking of minutes used per billing period

-- Add call_duration_minutes column to calls table (calculated from started_at and ended_at)
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS call_duration_minutes NUMERIC(10, 2);

-- Create index for efficient usage queries
CREATE INDEX IF NOT EXISTS idx_calls_firm_id_started_at ON calls(firm_id, started_at DESC);

-- Create function to calculate call duration in minutes
CREATE OR REPLACE FUNCTION calculate_call_duration_minutes(
  call_started_at TIMESTAMP WITH TIME ZONE,
  call_ended_at TIMESTAMP WITH TIME ZONE
) RETURNS NUMERIC(10, 2) AS $$
BEGIN
  IF call_ended_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate duration in minutes (rounded to 2 decimal places)
  RETURN ROUND(EXTRACT(EPOCH FROM (call_ended_at - call_started_at)) / 60.0, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing calls with duration (if ended_at exists)
UPDATE calls
SET call_duration_minutes = calculate_call_duration_minutes(started_at, ended_at)
WHERE ended_at IS NOT NULL AND call_duration_minutes IS NULL;

-- Create function to get usage for a firm in a billing period
CREATE OR REPLACE FUNCTION get_firm_usage_minutes(
  p_firm_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
) RETURNS NUMERIC(10, 2) AS $$
DECLARE
  total_minutes NUMERIC(10, 2);
BEGIN
  SELECT COALESCE(SUM(call_duration_minutes), 0)
  INTO total_minutes
  FROM calls
  WHERE firm_id = p_firm_id
    AND started_at >= p_period_start
    AND started_at < p_period_end
    AND call_duration_minutes IS NOT NULL;
  
  RETURN COALESCE(total_minutes, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to get current billing period usage
CREATE OR REPLACE FUNCTION get_current_period_usage_minutes(p_firm_id UUID)
RETURNS NUMERIC(10, 2) AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
  period_end TIMESTAMP WITH TIME ZONE;
  firm_subscription_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get subscription period end from firms table
  SELECT subscription_current_period_end
  INTO firm_subscription_period_end
  FROM firms
  WHERE id = p_firm_id;
  
  -- If no subscription period, use current month
  IF firm_subscription_period_end IS NULL THEN
    period_start := date_trunc('month', NOW());
    period_end := date_trunc('month', NOW()) + INTERVAL '1 month';
  ELSE
    -- Calculate period start (30 days before period end, or use subscription start)
    -- For simplicity, we'll use 30 days before period end
    period_start := firm_subscription_period_end - INTERVAL '30 days';
    period_end := firm_subscription_period_end;
  END IF;
  
  RETURN get_firm_usage_minutes(p_firm_id, period_start, period_end);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create trigger to automatically calculate duration when call ends
CREATE OR REPLACE FUNCTION update_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND (OLD.ended_at IS NULL OR OLD.ended_at != NEW.ended_at) THEN
    NEW.call_duration_minutes := calculate_call_duration_minutes(NEW.started_at, NEW.ended_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_call_duration ON calls;
CREATE TRIGGER trigger_update_call_duration
  BEFORE UPDATE ON calls
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL)
  EXECUTE FUNCTION update_call_duration();

-- Add comments
COMMENT ON COLUMN calls.call_duration_minutes IS 'Call duration in minutes, calculated from started_at and ended_at';
COMMENT ON FUNCTION calculate_call_duration_minutes IS 'Calculates call duration in minutes from start and end timestamps';
COMMENT ON FUNCTION get_firm_usage_minutes IS 'Gets total minutes used by a firm in a specific time period';
COMMENT ON FUNCTION get_current_period_usage_minutes IS 'Gets current billing period usage in minutes for a firm';

