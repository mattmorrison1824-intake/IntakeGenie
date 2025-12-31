-- Add 'sending_email' status to calls table
-- This is a temporary status used as a lock mechanism to prevent duplicate emails

-- Drop the existing CHECK constraint
ALTER TABLE calls
DROP CONSTRAINT IF EXISTS calls_status_check;

-- Recreate the CHECK constraint with 'sending_email' added
ALTER TABLE calls
ADD CONSTRAINT calls_status_check 
CHECK (status IN ('in_progress', 'transcribing', 'summarizing', 'sending_email', 'emailed', 'error'));

-- Add comment explaining the new status
COMMENT ON COLUMN calls.status IS 'Call status: in_progress -> transcribing -> summarizing -> sending_email -> emailed (or error)';

