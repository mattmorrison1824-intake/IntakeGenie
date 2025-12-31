// Database types for Supabase
// This is a simplified version - Supabase can generate full types, but this works for MVP

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      firms: {
        Row: {
          id: string;
          owner_user_id: string;
          firm_name: string;
          timezone: string;
          forward_to_number: string;
          notify_emails: string[];
          mode: 'after_hours' | 'failover' | 'both';
          open_days: number[];
          open_time: string;
          close_time: string;
          failover_ring_seconds: number;
          twilio_number: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          firm_name: string;
          timezone?: string;
          forward_to_number: string;
          notify_emails?: string[];
          mode?: 'after_hours' | 'failover' | 'both';
          open_days?: number[];
          open_time?: string;
          close_time?: string;
          failover_ring_seconds?: number;
          twilio_number?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          firm_name?: string;
          timezone?: string;
          forward_to_number?: string;
          notify_emails?: string[];
          mode?: 'after_hours' | 'failover' | 'both';
          open_days?: number[];
          open_time?: string;
          close_time?: string;
          failover_ring_seconds?: number;
          twilio_number?: string | null;
          created_at?: string;
        };
      };
      calls: {
        Row: {
          id: string;
          firm_id: string;
          twilio_call_sid: string;
          from_number: string;
          to_number: string;
          started_at: string;
          ended_at: string | null;
          route_reason: 'after_hours' | 'no_answer' | 'manual_test';
          status: 'in_progress' | 'transcribing' | 'summarizing' | 'sending_email' | 'emailed' | 'error';
          urgency: 'normal' | 'high' | 'emergency_redirected';
          recording_url: string | null;
          transcript_text: string | null;
          intake_json: Json | null;
          summary_json: Json | null;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          firm_id: string;
          twilio_call_sid: string;
          from_number: string;
          to_number: string;
          started_at?: string;
          ended_at?: string | null;
          route_reason: 'after_hours' | 'no_answer' | 'manual_test';
          status?: 'in_progress' | 'transcribing' | 'summarizing' | 'sending_email' | 'emailed' | 'error';
          urgency?: 'normal' | 'high' | 'emergency_redirected';
          recording_url?: string | null;
          transcript_text?: string | null;
          intake_json?: Json | null;
          summary_json?: Json | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          firm_id?: string;
          twilio_call_sid?: string;
          from_number?: string;
          to_number?: string;
          started_at?: string;
          ended_at?: string | null;
          route_reason?: 'after_hours' | 'no_answer' | 'manual_test';
          status?: 'in_progress' | 'transcribing' | 'summarizing' | 'sending_email' | 'emailed' | 'error';
          urgency?: 'normal' | 'high' | 'emergency_redirected';
          recording_url?: string | null;
          transcript_text?: string | null;
          intake_json?: Json | null;
          summary_json?: Json | null;
          error_message?: string | null;
        };
      };
    };
  };
}

