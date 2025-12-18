-- Add call_category column to calls table
-- This stores the type of call (e.g., "Work Injury Intake", "Car Accident Intake", "General Questioning")

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS call_category TEXT;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_calls_call_category ON calls(call_category);

