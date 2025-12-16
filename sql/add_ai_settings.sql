-- Add AI Receptionist Settings and Knowledge Base fields to firms table

ALTER TABLE firms
ADD COLUMN IF NOT EXISTS ai_greeting_custom TEXT,
ADD COLUMN IF NOT EXISTS ai_tone TEXT DEFAULT 'professional' CHECK (ai_tone IN ('professional', 'warm', 'friendly', 'formal')),
ADD COLUMN IF NOT EXISTS ai_knowledge_base TEXT;

COMMENT ON COLUMN firms.ai_greeting_custom IS 'Custom greeting line for AI receptionist. If null, uses default greeting.';
COMMENT ON COLUMN firms.ai_tone IS 'Tone setting for AI receptionist: professional, warm, friendly, or formal';
COMMENT ON COLUMN firms.ai_knowledge_base IS 'Additional context about the firm to help AI receptionist answer questions effectively';

