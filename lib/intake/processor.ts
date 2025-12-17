import { createServiceClient } from '@/lib/clients/supabase';
import { generateSummary } from '@/lib/utils/summarize';
import { sendIntakeEmail } from '@/lib/clients/resend';
import { IntakeData, SummaryData, UrgencyLevel } from '@/types';

/**
 * Upsert call record with intake data (called during conversation)
 */
export async function upsertCall({
  conversationId,
  firmId,
  intake,
}: {
  conversationId: string;
  firmId?: string;
  intake?: any;
}) {
  const supabase = createServiceClient();

  console.log('[Upsert Call] conversationId:', conversationId, 'firmId:', firmId);

  // Find or create call record
  const { data: existingCall, error: findError } = await supabase
    .from('calls')
    .select('id')
    .eq('vapi_conversation_id', conversationId)
    .maybeSingle();

  console.log('[Upsert Call] Existing call lookup:', existingCall, 'Error:', findError);

  if (existingCall && (existingCall as any).id) {
    // Update existing call
    console.log('[Upsert Call] Updating existing call:', (existingCall as any).id);
    const { error: updateError } = await supabase
      .from('calls')
      // @ts-ignore
      .update({
        intake_json: intake as IntakeData,
        status: 'in_progress',
        urgency: intake?.urgency_level === 'high' ? 'high' : intake?.emergency_redirected ? 'emergency_redirected' : 'normal',
      })
      .eq('id', (existingCall as any).id);
    
    if (updateError) {
      console.error('[Upsert Call] Error updating call:', updateError);
    }
  } else if (firmId) {
    // Create new call record
    console.log('[Upsert Call] Creating new call record for firmId:', firmId);
    const { data: newCall, error: insertError } = await supabase
      .from('calls')
      // @ts-ignore
      .insert({
        vapi_conversation_id: conversationId,
        firm_id: firmId,
        intake_json: intake as IntakeData,
        status: 'in_progress',
        urgency: intake?.urgency_level === 'high' ? 'high' : intake?.emergency_redirected ? 'emergency_redirected' : 'normal',
        started_at: new Date().toISOString(),
        from_number: '', // Will be updated in finalizeCall
        to_number: '', // Will be updated in finalizeCall
        route_reason: 'after_hours', // Default for Vapi calls
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[Upsert Call] Error creating call:', insertError);
    } else {
      console.log('[Upsert Call] Call created successfully:', newCall);
    }
  } else {
    console.warn('[Upsert Call] No firmId provided and no existing call found. Cannot create call record.');
  }
}

/**
 * Finalize call: save transcript, generate summary, send email
 */
export async function finalizeCall({
  conversationId,
  transcript,
  phoneNumber,
  firmId,
}: {
  conversationId: string;
  transcript?: string;
  phoneNumber?: string;
  firmId?: string;
}) {
  const supabase = createServiceClient();

  console.log('[Finalize Call] conversationId:', conversationId, 'firmId:', firmId, 'phoneNumber:', phoneNumber);

  // Find call record
  const { data: callData, error: callError } = await supabase
    .from('calls')
    .select('*, firms(*)')
    .eq('vapi_conversation_id', conversationId)
    .maybeSingle();

  console.log('[Finalize Call] Call lookup result:', callData, 'Error:', callError);

  // If call doesn't exist, create it now (in case conversation.updated wasn't received)
  if (callError || !callData) {
    console.warn('[Finalize Call] Call not found, creating it now');
    if (firmId) {
      const { data: newCall, error: createError } = await supabase
        .from('calls')
        // @ts-ignore
        .insert({
          vapi_conversation_id: conversationId,
          firm_id: firmId,
          from_number: phoneNumber || '',
          to_number: '', // Vapi phone number - will be looked up from firm
          status: 'summarizing',
          urgency: 'normal',
          started_at: new Date().toISOString(), // Approximate
          route_reason: 'after_hours',
        })
        .select('*, firms(*)')
        .single();
      
      if (createError) {
        console.error('[Finalize Call] Error creating call:', createError);
        return;
      }
      
      // Use the newly created call
      const call = newCall as any;
      const intake = (call.intake_json as IntakeData) || {};
      
      // Continue with finalization
      await finalizeCallRecord(supabase, call, intake, transcript, phoneNumber);
    } else {
      console.error('[Finalize Call] Cannot create call - no firmId provided');
      return;
    }
  } else {
    const call = callData as any;
    const intake = (call.intake_json as IntakeData) || {};
    await finalizeCallRecord(supabase, call, intake, transcript, phoneNumber);
  }
}

async function finalizeCallRecord(
  supabase: ReturnType<typeof createServiceClient>,
  call: any,
  intake: IntakeData,
  transcript?: string,
  phoneNumber?: string
) {

  // Update call with transcript and end time
  const { error: updateError } = await supabase
    .from('calls')
    // @ts-ignore
    .update({
      transcript_text: transcript || null,
      from_number: phoneNumber || call.from_number || '',
      ended_at: new Date().toISOString(),
      status: 'summarizing',
    })
    .eq('id', call.id);
  
  if (updateError) {
    console.error('[Finalize Call] Error updating call:', updateError);
  }

  // Generate summary
  let summary: SummaryData;
  try {
    summary = await generateSummary(transcript || 'No transcript available.', intake);
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ summary_json: summary as any, status: 'summarizing' })
      .eq('id', call.id);
  } catch (error) {
    console.error('[Intake Processor] Summarization error:', error);
    // Create fallback summary
    summary = {
      title: `Intake Call - ${intake.full_name || 'Unknown'}`,
      summary_bullets: [
        `Caller: ${intake.full_name || 'Unknown'}`,
        `Phone: ${intake.callback_number || 'Not provided'}`,
        `Reason: ${intake.reason_for_call || 'Not specified'}`,
      ],
      key_facts: {
        incident_date: intake.incident_date_or_timeframe,
        location: intake.incident_location,
        injuries: intake.injury_description,
        treatment: intake.medical_treatment_received,
        insurance: intake.insurance_involved,
      },
      action_items: ['Review intake details', 'Follow up with caller'],
      urgency_level: (call.urgency as UrgencyLevel) || 'normal',
      follow_up_recommendation: 'Standard follow-up recommended',
    };
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ summary_json: summary as any, status: 'summarizing' })
      .eq('id', call.id);
  }

  // Send email
  const firm = call.firms as any;
  if (firm && firm.notify_emails && firm.notify_emails.length > 0) {
    try {
      await sendIntakeEmail(
        firm.notify_emails,
        intake,
        summary,
        transcript || null,
        null, // Recording URL (Vapi may provide this separately)
        call.urgency as UrgencyLevel
      );
      await supabase
        .from('calls')
        // @ts-ignore
        .update({ status: 'emailed' })
        .eq('id', call.id);
    } catch (error) {
      console.error('[Intake Processor] Email sending failed:', error);
      await supabase
        .from('calls')
        // @ts-ignore
        .update({
          status: 'error',
          error_message: `Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        .eq('id', call.id);
    }
  } else {
    // No email addresses configured - still mark as emailed
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ status: 'emailed' })
      .eq('id', call.id);
  }
}

