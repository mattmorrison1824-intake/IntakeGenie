import { createServiceClient } from '@/lib/clients/supabase';
import { generateSummary } from '@/lib/utils/summarize';
import { sendIntakeEmail } from '@/lib/clients/resend';
import { IntakeData, SummaryData, UrgencyLevel } from '@/types';

/**
 * Extract call category from summary title
 * Examples: "Work Injury Intake - John Doe" -> "Work Injury Intake"
 *           "Car Accident Intake - Jane Smith" -> "Car Accident Intake"
 *           "General Questioning - Bob" -> "General Questioning"
 */
function extractCategoryFromTitle(title: string): string {
  // Extract the part before the dash (if present)
  const match = title.match(/^([^-]+?)(?:\s*-\s*|$)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  // If no dash, return the title as-is (truncated if too long)
  return title.length > 50 ? title.substring(0, 50).trim() : title.trim();
}

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
      .select('inbound_number_e164')
      .eq('id', firmId)
      .single();
    
    const toNumber = (firmData as any)?.inbound_number_e164 || '';
    
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
  endedAt,
}: {
  conversationId: string;
  transcript?: string;
  phoneNumber?: string;
  firmId?: string;
  intake?: any;
  recordingUrl?: string;
  endedAt?: string; // Optional: actual call end time from Vapi
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
        .select('inbound_number_e164')
        .eq('id', firmId)
        .single();
      
      const toNumber = (firmData as any)?.inbound_number_e164 || '';
      
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
      await finalizeCallRecord(supabase, call, finalIntake, transcript, phoneNumber, recordingUrl, endedAt);
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
  recordingUrl?: string,
  endedAt?: string // Optional: actual call end time from Vapi
) {
  // CRITICAL: Do atomic email lock check FIRST before any updates
  // This prevents duplicate emails in race conditions
  // Check if we should send email and acquire lock atomically
  const firm = call.firms as any;
  let shouldSendEmail = false;
  
  if (firm && firm.notify_emails && firm.notify_emails.length > 0) {
    // Use atomic UPDATE: only update status to 'sending_email' if it's NOT already 'emailed' or 'sending_email'
    // This prevents duplicate emails in race conditions
    const { data: lockResult, error: lockError } = await supabase
      .from('calls')
      // @ts-ignore
      .update({ status: 'sending_email' })
      .eq('id', call.id)
      .neq('status', 'emailed')
      .neq('status', 'sending_email')
      .select('id, status')
      .maybeSingle();

    // If lockResult is null, the update didn't match any rows (status was already 'emailed' or 'sending_email')
    // If lockError exists, there was a database error
    if (!lockResult || lockError) {
      if (lockError && lockError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected if already emailed
        console.error('[Finalize Call] Error in atomic lock check:', lockError);
      }
      console.log('[Finalize Call] Email already sent or being sent (atomic check) for call:', call.id, '- skipping email');
      shouldSendEmail = false;
    } else {
      shouldSendEmail = true;
      console.log('[Finalize Call] Acquired email lock for call:', call.id);
    }
  }

  // Early exit if already emailed (quick check)
  if (call.status === 'emailed') {
    console.log('[Finalize Call] Email already sent for call:', call.id, '- skipping email');
    return;
  }

  // Update call with transcript, intake data, caller number, recording URL, and end time
  // Use new recording URL if provided (even if empty string), otherwise preserve existing one
  // Use provided endedAt if available and valid (after started_at), otherwise preserve existing or use current time
  let finalEndedAt = endedAt || call.ended_at || new Date().toISOString();
  
  // Validate that ended_at is after started_at
  if (call.started_at) {
    const startTime = new Date(call.started_at).getTime();
    const endTime = new Date(finalEndedAt).getTime();
    
    // If the end time is before start time or invalid, use current time instead
    if (isNaN(endTime) || endTime < startTime) {
      console.warn('[Finalize Call] Invalid ended_at (before started_at), using current time instead:', {
        started_at: call.started_at,
        provided_ended_at: endedAt,
        current_ended_at: call.ended_at,
      });
      finalEndedAt = new Date().toISOString();
    }
  }
  
  // Update call data - don't touch status here, it's already set by atomic lock if sending email
  const updateData: any = {
    transcript_text: transcript || call.transcript_text || null,
    from_number: phoneNumber || call.from_number || '',
    // Use recordingUrl if it's a non-empty string, otherwise preserve existing
    recording_url: (recordingUrl && recordingUrl.trim()) ? recordingUrl : (call.recording_url || null),
    ended_at: finalEndedAt,
  };
  
  // Only update status if we're NOT sending email (set to 'summarizing' to indicate processing)
  // If we're sending email, status is already 'sending_email' from atomic lock - don't overwrite it
  if (!shouldSendEmail) {
    updateData.status = 'summarizing';
  }
  
  // Log intake data for debugging name extraction
  if (intake && Object.keys(intake).length > 0) {
    console.log('[Finalize Call] Intake data:', JSON.stringify(intake, null, 2));
    console.log('[Finalize Call] Intake full_name:', intake.full_name || 'NOT SET');
  }
  
  // Log recording URL update for debugging
  if (recordingUrl) {
    console.log('[Finalize Call] Updating recording URL:', recordingUrl);
  } else if (call.recording_url) {
    console.log('[Finalize Call] Preserving existing recording URL:', call.recording_url);
  } else {
    console.log('[Finalize Call] No recording URL available');
  }
  
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

  // Fetch the latest call record to ensure we have the most up-to-date data
  const { data: updatedCall, error: fetchError } = await supabase
    .from('calls')
    .select('*, firms(*)')
    .eq('id', call.id)
    .single();

  if (fetchError) {
    console.error('[Finalize Call] Error fetching updated call:', fetchError);
  }

  // Use the updated call record if available, otherwise use the original
  const currentCall = (updatedCall as any) || call;

  // Generate summary
  let summary: SummaryData;
  try {
    summary = await generateSummary(transcript || 'No transcript available.', intake);
    // Update summary - don't touch status (preserve 'sending_email' if we're sending email)
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ summary_json: summary as any })
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
    // Update fallback summary - don't touch status (preserve 'sending_email' if we're sending email)
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ summary_json: summary as any })
      .eq('id', call.id);
  }

  // Send email if we acquired the lock earlier
  if (shouldSendEmail) {
    // Get firm from currentCall to ensure we have the latest data
    const currentFirm = currentCall.firms as any;
    if (!currentFirm || !currentFirm.notify_emails || currentFirm.notify_emails.length === 0) {
      console.log('[Finalize Call] No email addresses configured, skipping email send');
      // Mark as emailed since there's nothing to send
      await supabase
        .from('calls')
        // @ts-ignore
        .update({ status: 'emailed' })
        .eq('id', call.id);
      return;
    }
    
    // Get the most up-to-date recording URL from the database
    const finalRecordingUrl = recordingUrl || currentCall.recording_url || call.recording_url || null;
    
    console.log('[Finalize Call] Sending email with recording URL:', finalRecordingUrl ? 'Yes' : 'No');
    if (finalRecordingUrl) {
      console.log('[Finalize Call] Recording URL:', finalRecordingUrl);
    }
    
    try {
      await sendIntakeEmail(
        currentFirm.notify_emails,
        intake,
        summary,
        transcript || null,
        finalRecordingUrl, // Use the most up-to-date recording URL
        currentCall.urgency as UrgencyLevel,
        currentCall.from_number || phoneNumber // Pass caller's phone number from call metadata
      );
      // Mark as emailed only after successful email send
      // Update unconditionally - we acquired the lock, email was sent, so mark as emailed
      const { data: updateResult, error: updateError } = await supabase
        .from('calls')
        // @ts-ignore
        .update({ status: 'emailed' })
        .eq('id', call.id)
        .select('id, status')
        .maybeSingle();
      
      if (updateError) {
        console.error('[Finalize Call] Error updating status to emailed:', updateError);
      } else if (!updateResult) {
        console.warn('[Finalize Call] Update to emailed returned no rows for call:', call.id);
      } else {
        console.log('[Finalize Call] Email sent successfully and status updated to emailed for call:', call.id);
      }
    } catch (error) {
      console.error('[Intake Processor] Email sending failed:', error);
      // Reset status on error so it can be retried - only if still in 'sending_email' state
      await supabase
        .from('calls')
        // @ts-ignore
        .update({
          status: 'error',
          error_message: `Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        .eq('id', call.id)
        .eq('status', 'sending_email'); // Only update if still in 'sending_email' state
    }
  } else if (!firm || !firm.notify_emails || firm.notify_emails.length === 0) {
    // No email addresses configured - mark as emailed (no email to send)
    await supabase
      .from('calls')
      // @ts-ignore
      .update({ status: 'emailed' })
      .eq('id', call.id);
  }
}

