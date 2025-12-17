-- Add DELETE policy for calls table
-- Run this in your Supabase SQL Editor

CREATE POLICY "Users can delete calls for their firms"
  ON calls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM firms
      WHERE firms.id = calls.firm_id
      AND firms.owner_user_id = auth.uid()
    )
  );

