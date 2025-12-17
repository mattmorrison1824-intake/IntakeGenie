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
  phoneNumber,
}: {
  conversationId: string;
  firmId?: string;
  intake?: any;
  phoneNumber?: string;
}): Promise<{ success: boolean; callId?: string; error?: any }> {
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
      return { success: false, error: updateError };
    } else {
      console.log('[Upsert Call] Call updated successfully');
      return { success: true, callId: (existingCall as any).id };
    }
  } else if (firmId) {
    // Create new call record
    console.log('[Upsert Call] Creating new call record for firmId:', firmId);
    
    // Get firm's phone number for to_number
    const { data: firmData } = await supabase
      .from('firms')
      .select('vapi_phone_number')
      .eq('id', firmId)
      .single();
    
    const toNumber = (firmData as any)?.vapi_phone_number || '';
    
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
        from_number: phoneNumber || '', // Caller's number
        to_number: toNumber,
        route_reason: 'after_hours', // Default for Vapi calls
        twilio_call_sid: null, // Vapi calls don't have Twilio call SID
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[Upsert Call] Error creating call:', insertError);
      console.error('[Upsert Call] Insert error details:', JSON.stringify(insertError, null, 2));
      console.error('[Upsert Call] Insert error code:', insertError.code);
      console.error('[Upsert Call] Insert error message:', insertError.message);
      return { success: false, error: insertError };
    } else {
      const callId = (newCall as any)?.id;
      console.log('[Upsert Call] Call created successfully:', JSON.stringify(newCall, null, 2));
      console.log('[Upsert Call] Call ID:', callId);
      console.log('[Upsert Call] Firm ID:', firmId);
      return { success: true, callId };
    }
  } else {
    console.warn('[Upsert Call] No firmId provided and no existing call found. Cannot create call record.');
    console.warn('[Upsert Call] Conversation ID:', conversationId);
    console.warn('[Upsert Call] This means the webhook could not find the firm. Check server logs for firm lookup errors.');
    return { success: false, error: 'No firmId provided' };
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
  intake,
  recordingUrl,
}: {
  conversationId: string;
  transcript?: string;
  phoneNumber?: string;
  firmId?: string;
  intake?: any;
  recordingUrl?: string;
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
      // Get firm's phone number for to_number
      const { data: firmData } = await supabase
        .from('firms')
        .select('vapi_phone_number')
        .eq('id', firmId)
        .single();
      
      const toNumber = (firmData as any)?.vapi_phone_number || '';
      
      const { data: newCall, error: createError } = await supabase
        .from('calls')
        // @ts-ignore
        .insert({
          vapi_conversation_id: conversationId,
          firm_id: firmId,
          from_number: phoneNumber || '',
          to_number: toNumber,
          status: 'summarizing',
          urgency: 'normal',
          started_at: new Date().toISOString(), // Approximate
          route_reason: 'after_hours',
          twilio_call_sid: null, // Vapi calls don't have Twilio call SID
        })
        .select('*, firms(*)')
        .single();
      
      if (createError) {
        console.error('[Finalize Call] Error creating call:', createError);
        return;
      }
      
      console.log('[Finalize Call] Call created successfully:', newCall);
      
      // Use the newly created call
      const call = newCall as any;
      // Use provided intake data, or fall back to existing intake_json
      const finalIntake = intake || (call.intake_json as IntakeData) || {};
      
      // Update call with intake data if provided
      if (intake && Object.keys(intake).length > 0) {
        await supabase
          .from('calls')
          // @ts-ignore
          .update({ intake_json: intake as IntakeData })
          .eq('id', call.id);
      }
      
      // Continue with finalization
      await finalizeCallRecord(supabase, call, finalIntake, transcript, phoneNumber, recordingUrl);
    } else {
      console.error('[Finalize Call] Cannot create call - no firmId provided. Conversation ID:', conversationId);
      console.error('[Finalize Call] This means the webhook could not find the firm. Check server logs for firm lookup errors.');
      return;
    }
  } else {
    const call = callData as any;
    // Use provided intake data, or fall back to existing intake_json
    const finalIntake = intake || (call.intake_json as IntakeData) || {};
    await finalizeCallRecord(supabase, call, finalIntake, transcript, phoneNumber, recordingUrl);
  }
}

async function finalizeCallRecord(
  supabase: ReturnType<typeof createServiceClient>,
  call: any,
  intake: IntakeData,
  transcript?: string,
  phoneNumber?: string,
  recordingUrl?: string
) {

  // Update call with transcript, intake data, caller number, recording URL, and end time
  const updateData: any = {
    transcript_text: transcript || null,
    from_number: phoneNumber || call.from_number || '',
    recording_url: recordingUrl || call.recording_url || null,
    ended_at: new Date().toISOString(),
    status: 'summarizing',
  };
  
  // Update intake_json if we have intake data
  if (intake && Object.keys(intake).length > 0) {
    updateData.intake_json = intake as IntakeData;
  }
  
  const { error: updateError } = await supabase
    .from('calls')
    // @ts-ignore
    .update(updateData)
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
        recordingUrl || call.recording_url || null, // Use recording URL if available
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

