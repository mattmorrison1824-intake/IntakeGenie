import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { twilioClient } from '@/lib/clients/twilio';
import { transcribeRecording } from '@/lib/clients/deepgram';
import { generateSummary } from '@/lib/utils/summarize';
import { sendIntakeEmail, resend } from '@/lib/clients/resend';
import { IntakeData, SummaryData, UrgencyLevel } from '@/types';

/**
 * Send basic fallback email when full summary email fails
 */
async function sendBasicFallbackEmail(
  to: string[],
  intake: IntakeData,
  transcript: string | null,
  recordingUrl: string | null,
  urgency: UrgencyLevel,
  callerPhoneNumber?: string
) {
  const subject = urgency === 'high' 
    ? `[HIGH URGENCY] Intake Call - ${intake.full_name || 'Unknown'} — ${new Date().toLocaleDateString()}`
    : `Intake Call - ${intake.full_name || 'Unknown'} — ${new Date().toLocaleDateString()}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h2 { color: #2563eb; }
          h3 { color: #1e40af; margin-top: 1.5em; }
          ul { margin: 0.5em 0; }
          pre { font-size: 0.9em; background: #f5f5f5; padding: 1em; border-radius: 4px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h2>Intake Call - Basic Summary</h2>
        <p><em>Note: Full summary generation failed. Below is available intake data.</em></p>
        <h3>Caller Details</h3>
        <ul>
          <li><strong>Name:</strong> ${intake.full_name || 'Not provided'}</li>
          <li><strong>Phone:</strong> ${intake.callback_number || callerPhoneNumber || 'Not provided'}</li>
          <li><strong>Email:</strong> ${intake.email || 'Not provided'}</li>
        </ul>
        ${intake.reason_for_call ? `<h3>Reason for Call</h3><p>${intake.reason_for_call}</p>` : ''}
        <div style="margin-top: 2em; padding: 1em; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px;">
          <strong>Note:</strong> Full transcript and call recording are available in the IntakeGenie platform. Please log in to view the complete details.
          ${recordingUrl ? `<p style="margin-top: 1em;"><strong>Call Recording:</strong> <a href="${recordingUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">Listen to Recording</a></p>` : ''}
        </div>
      </body>
    </html>
  `;

  // Use Resend's default from address
  const fromAddress = 'IntakeGenie <onboarding@resend.dev>';

  console.log('[Process Call] Sending fallback email:', {
    to,
    from: fromAddress,
    subject,
  });

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('[Process Call] Fallback email error:', error);
    throw error;
  }

  console.log('[Process Call] Fallback email sent successfully:', data?.id);
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const callSid = request.nextUrl.searchParams.get('callSid');

    if (!callSid) {
      return new Response('Missing callSid', { status: 400 });
    }

    const supabase = createServiceClient();

    // Get call record
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('*, firms(*)')
      .eq('twilio_call_sid', callSid)
      .single();

    if (callError || !callData) {
      console.error('Call not found:', callError);
      return new Response('Call not found', { status: 404 });
    }

    const call = callData as any;

    // Only update to transcribing if not already in that state (avoid race conditions)
    if (call.status !== 'transcribing' && call.status !== 'summarizing' && call.status !== 'emailed') {
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ status: 'transcribing' })
        // @ts-ignore - Supabase type inference issue
        .eq('id', call.id);
    }

    let transcript = call.transcript_text;
    let recordingUrl = call.recording_url;

    console.log(`[Process Call] Starting processing for call ${callSid}, current status: ${call.status}, has recording: ${!!recordingUrl}, has transcript: ${!!transcript}`);

    // If no recording URL, try to fetch from Twilio
    // Twilio recordings may not be immediately available after call ends, so retry with delay
    if (!recordingUrl) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      if (!accountSid) {
        console.error('[Process Call] TWILIO_ACCOUNT_SID not configured');
      } else {
        // Retry up to 3 times with increasing delays (Twilio recordings may take time to process)
        let recordings: any[] = [];
        const maxRetries = 3;
        const delays = [2000, 5000, 10000]; // 2s, 5s, 10s
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`[Process Call] Fetching recordings for call ${callSid} (attempt ${attempt + 1}/${maxRetries})...`);
            
            // Use the account-specific recordings API
            recordings = await twilioClient.api.v2010.accounts(accountSid).recordings.list({
              callSid: callSid,
              limit: 1,
            });

            console.log(`[Process Call] Found ${recordings.length} recording(s) for call ${callSid}`);

            if (recordings.length > 0) {
              break; // Found recording, exit retry loop
            }
            
            // If no recording found and not last attempt, wait before retrying
            if (attempt < maxRetries - 1) {
              console.log(`[Process Call] No recording found yet, waiting ${delays[attempt]}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            }
          } catch (error) {
            console.error(`[Process Call] Error fetching recording (attempt ${attempt + 1}):`, error);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            }
          }
        }

        if (recordings.length > 0) {
          // Twilio recording URI format: /Accounts/{AccountSid}/Recordings/{RecordingSid}.json
          // Audio file format: /Accounts/{AccountSid}/Recordings/{RecordingSid}.mp3
          const recordingSid = recordings[0].sid;
          recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
          
          console.log(`[Process Call] Recording URL: ${recordingUrl}`);
          
          await supabase
            .from('calls')
            // @ts-ignore - Supabase type inference issue
            .update({ recording_url: recordingUrl })
            // @ts-ignore - Supabase type inference issue
            .eq('id', call.id);
        } else {
          console.warn(`[Process Call] No recordings found for call ${callSid} after ${maxRetries} attempts - call may not have been recorded. Will proceed without transcript.`);
          // Update status to summarizing since we're skipping transcription
          await supabase
            .from('calls')
            // @ts-ignore - Supabase type inference issue
            .update({ status: 'summarizing' })
            // @ts-ignore - Supabase type inference issue
            .eq('id', call.id);
        }
      }
    }

    // Transcribe if we have a recording and no transcript
    if (recordingUrl && !transcript) {
      try {
        console.log(`[Process Call] Starting transcription for call ${callSid} with URL: ${recordingUrl}`);
        transcript = await transcribeRecording(recordingUrl);
        console.log(`[Process Call] Transcription successful for call ${callSid}, length: ${transcript.length}`);
        
        await supabase
          .from('calls')
          // @ts-ignore - Supabase type inference issue
          .update({ transcript_text: transcript, status: 'summarizing' })
          // @ts-ignore - Supabase type inference issue
          .eq('id', call.id);
      } catch (error) {
        console.error('[Process Call] Transcription error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Process Call] Error details:', errorMessage);
        
        await supabase
          .from('calls')
          // @ts-ignore - Supabase type inference issue
          .update({
            status: 'error',
            error_message: `Transcription failed: ${errorMessage}`,
          })
          // @ts-ignore - Supabase type inference issue
          .eq('id', call.id);
        
        // Don't return early - continue with summary using intake data only
        transcript = null;
      }
    } else if (!recordingUrl && !transcript) {
      // If no recording and no transcript, skip to summary with what we have
      console.log('[Process Call] No recording available, proceeding with intake data only');
      // Update status to summarizing since we're skipping transcription
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ status: 'summarizing' })
        // @ts-ignore - Supabase type inference issue
        .eq('id', call.id);
    } else if (!transcript && recordingUrl) {
      console.log('[Process Call] Recording URL exists but transcript is missing - transcription may have failed previously');
      // If we have a recording URL but no transcript, transcription likely failed
      // Mark as error or proceed without transcript
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ 
          status: 'summarizing',
          error_message: 'Recording exists but transcription unavailable - proceeding with intake data only'
        })
        // @ts-ignore - Supabase type inference issue
        .eq('id', call.id);
    }

    // Generate summary (even if no transcript, use intake data)
    const intake = (call.intake_json as IntakeData) || {};
    let summary: SummaryData;

    // Helper function to extract category from summary title
    const extractCategoryFromTitle = (title: string): string => {
      const match = title.match(/^([^-]+?)(?:\s*-\s*|$)/);
      if (match && match[1]) {
        return match[1].trim();
      }
      return title.length > 50 ? title.substring(0, 50).trim() : title.trim();
    };

    try {
      summary = await generateSummary(transcript || 'No transcript available.', intake);
      const category = extractCategoryFromTitle(summary.title);
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ summary_json: summary as any, call_category: category, status: 'summarizing' })
        // @ts-ignore - Supabase type inference issue
        .eq('id', call.id);
    } catch (error) {
      console.error('[Process Call] Summarization error:', error);
      // Create fallback summary instead of failing
      summary = {
        title: `Intake Call - ${intake.full_name || 'Unknown'}`,
        summary_bullets: [
          `Caller: ${intake.full_name || 'Unknown'}`,
          `Phone: ${intake.callback_number || 'Not provided'}`,
          `Reason: ${intake.reason_for_call || 'Not specified'}`,
          transcript ? 'Full transcript available below' : 'No transcript available',
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
        follow_up_recommendation: 'Standard follow-up recommended - summary generation had issues',
      };
      const category = extractCategoryFromTitle(summary.title);
        await supabase
          .from('calls')
          // @ts-ignore - Supabase type inference issue
        .update({ summary_json: summary as any, call_category: category, status: 'summarizing' })
          // @ts-ignore - Supabase type inference issue
          .eq('id', call.id);
    }

    // Send email - ALWAYS send, even if summarization failed
    const firm = call.firms as any;
    if (firm && firm.notify_emails && firm.notify_emails.length > 0) {
      try {
        await sendIntakeEmail(
          firm.notify_emails,
          intake,
          summary,
          transcript,
          recordingUrl,
          call.urgency as any,
          call.from_number // Pass caller's phone number from call metadata
        );
        // Update status to emailed only after successful email
        await supabase
          .from('calls')
          // @ts-ignore - Supabase type inference issue
          .update({ status: 'emailed' })
          // @ts-ignore - Supabase type inference issue
          .eq('id', call.id);
      } catch (error) {
        console.error('[Process Call] Email sending failed after retries:', error);
        // Send fallback basic email
        try {
          await sendBasicFallbackEmail(
            firm.notify_emails,
            intake,
            transcript,
            recordingUrl,
            call.urgency as any,
            call.from_number
          );
          await supabase
            .from('calls')
            // @ts-ignore - Supabase type inference issue
            .update({ status: 'emailed' })
            // @ts-ignore - Supabase type inference issue
            .eq('id', call.id);
        } catch (fallbackError) {
          console.error('[Process Call] Fallback email also failed:', fallbackError);
          await supabase
            .from('calls')
            // @ts-ignore - Supabase type inference issue
            .update({
              status: 'error',
              error_message: `Email failed after retries and fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          // @ts-ignore - Supabase type inference issue
          .eq('id', call.id);
        return new Response('Email failed', { status: 500 });
      }
      }
    } else {
      // No email addresses configured - still mark as emailed
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ status: 'emailed' })
        // @ts-ignore - Supabase type inference issue
        .eq('id', call.id);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error in process-call:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

