// Core data types for IntakeGenie

// Deprecated - no longer used, kept for backward compatibility
export type RoutingMode = 'after_hours' | 'failover' | 'both';

export type CallStatus = 'in_progress' | 'transcribing' | 'summarizing' | 'sending_email' | 'emailed' | 'error';

export type UrgencyLevel = 'normal' | 'high' | 'emergency_redirected';

export type RouteReason = 'after_hours' | 'no_answer' | 'manual_test';

export type AITone = 'professional' | 'warm' | 'friendly' | 'formal';

export interface Firm {
  id: string;
  owner_user_id: string;
  firm_name: string;
  timezone: string;
  // Deprecated fields - no longer used in UI, kept for backward compatibility with database
  forward_to_number?: string; // Deprecated - users handle forwarding on their end
  notify_emails: string[];
  mode?: RoutingMode; // Deprecated - system is always on
  open_days?: number[]; // Deprecated - system is always on
  open_time?: string; // Deprecated - system is always on
  close_time?: string; // Deprecated - system is always on
  failover_ring_seconds?: number; // Deprecated - no routing rules
  twilio_number: string | null; // Deprecated - kept for migration
  vapi_phone_number: string | null; // Deprecated - kept for migration
  vapi_phone_number_id: string | null; // Vapi phone number ID for API lookups
  vapi_assistant_id: string | null; // Vapi assistant ID
  inbound_number_e164: string | null; // E.164 formatted phone number (e.g., +15551234567)
  twilio_phone_number_sid: string | null; // Twilio phone number SID (e.g., PN...)
  telephony_provider: string | null; // Telephony provider type: 'twilio_imported_into_vapi', 'vapi_free', etc.
  ai_greeting_custom: string | null;
  ai_tone: AITone;
  ai_knowledge_base: string | null;
  created_at: string;
}

export interface Call {
  id: string;
  firm_id: string;
  twilio_call_sid: string | null; // Deprecated - kept for migration
  vapi_conversation_id: string | null; // Vapi conversation ID
  from_number: string;
  to_number: string;
  started_at: string;
  ended_at: string | null;
  route_reason: RouteReason;
  status: CallStatus;
  urgency: UrgencyLevel;
  recording_url: string | null;
  transcript_text: string | null;
  intake_json: IntakeData | null;
  summary_json: SummaryData | null;
  call_category: string | null; // Type of call (e.g., "Work Injury Intake", "Car Accident Intake", "General Questioning")
  error_message: string | null;
}

export interface IntakeData {
  full_name?: string;
  callback_number?: string;
  email?: string;
  reason_for_call?: string;
  incident_date_or_timeframe?: string;
  incident_location?: string;
  injury_description?: string;
  medical_treatment_received?: 'yes' | 'no' | 'unknown';
  insurance_involved?: 'yes' | 'no' | 'unknown';
  urgency_level?: 'normal' | 'high';
  emergency_redirected?: boolean;
}

export interface SummaryData {
  title: string;
  summary_bullets: string[];
  key_facts: {
    incident_date?: string;
    location?: string;
    injuries?: string;
    treatment?: string;
    insurance?: string;
  };
  action_items: string[];
  urgency_level: UrgencyLevel;
  follow_up_recommendation: string;
}

export type ConversationState =
  | 'START'
  | 'EMERGENCY_CHECK'
  | 'EMERGENCY'
  | 'CONTACT_NAME'
  | 'CONTACT_PHONE'
  | 'CONTACT_EMAIL'
  | 'REASON'
  | 'INCIDENT_TIME'
  | 'INCIDENT_LOCATION'
  | 'INJURY'
  | 'TREATMENT'
  | 'INSURANCE'
  | 'URGENCY'
  | 'CONFIRM'
  | 'CLOSE'
  | 'SCHEDULE_CALLBACK';

export interface AgentResponse {
  assistant_say: string;
  next_state: ConversationState;
  updates: Partial<IntakeData>;
  done: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

