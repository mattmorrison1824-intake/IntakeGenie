import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { normalizeAppUrl } from '@/lib/clients/twilio';

// Ensure this route is public (can be called by cron)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Watchdog endpoint to detect and fix stuck calls
 * Should be called periodically (e.g., every 5 minutes via cron)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    // Simple auth check - use a secret token
    const expectedToken = process.env.WATCHDOG_SECRET || 'watchdog-secret';
    if (authHeader !== `Bearer ${expectedToken}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createServiceClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find calls stuck in transcribing or summarizing for >5 minutes
    const { data: stuckCalls, error } = await supabase
      .from('calls')
      .select('id, twilio_call_sid, status, intake_json, transcript_text, recording_url, firms!inner(notify_emails)')
      .in('status', ['transcribing', 'summarizing'])
      .lt('updated_at', fiveMinutesAgo);

    if (error) {
      console.error('[Watchdog] Error querying stuck calls:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!stuckCalls || stuckCalls.length === 0) {
      return NextResponse.json({ message: 'No stuck calls found', count: 0 });
    }

    console.log(`[Watchdog] Found ${stuckCalls.length} stuck calls, attempting recovery...`);

    const results = [];
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

    for (const call of stuckCalls) {
      try {
        // Trigger process-call again for each stuck call
        const response = await fetch(`${appUrl}/api/process-call?callSid=${(call as any).twilio_call_sid}`, {
          method: 'POST',
        });

        if (response.ok) {
          results.push({ callSid: (call as any).twilio_call_sid, status: 'retriggered' });
        } else {
          // If retrigger fails, mark as error and send fallback email
          const intake = (call as any).intake_json || {};
          const firm = (call as any).firms || {};
          const notifyEmails = firm.notify_emails || [];

          if (notifyEmails.length > 0) {
            // Send basic fallback email
            const { resend } = await import('@/lib/clients/resend');
            const fromAddress = process.env.RESEND_FROM_ADDRESS || 'IntakeGenie <onboarding@resend.dev>';
            
            console.log('[Watchdog] Sending fallback email for stuck call:', {
              to: notifyEmails,
              from: fromAddress,
              callSid: (call as any).twilio_call_sid,
            });
            
            try {
              const { data, error } = await resend.emails.send({
                from: fromAddress,
                to: notifyEmails,
                subject: `[STUCK CALL] Intake Call - ${intake.full_name || 'Unknown'}`,
                html: `
                  <h2>Intake Call - Processing Stuck</h2>
                  <p><em>This call was stuck in processing. Below is available data.</em></p>
                  <h3>Caller Details</h3>
                  <ul>
                    <li><strong>Name:</strong> ${intake.full_name || 'Not provided'}</li>
                    <li><strong>Phone:</strong> ${intake.callback_number || 'Not provided'}</li>
                  </ul>
                  ${(call as any).transcript_text ? `<h3>Transcript</h3><pre>${(call as any).transcript_text}</pre>` : ''}
                `,
              });
              
              if (error) {
                console.error('[Watchdog] Failed to send fallback email:', error);
              } else {
                console.log('[Watchdog] Fallback email sent successfully:', data?.id);
              }
            } catch (emailError) {
              console.error('[Watchdog] Error sending fallback email:', emailError);
            }
          }

          await supabase
            .from('calls')
            // @ts-ignore
            .update({
              status: 'error',
              error_message: 'Call stuck in processing for >5 minutes, watchdog triggered fallback',
            })
            // @ts-ignore
            .eq('id', call.id);

          results.push({ callSid: (call as any).twilio_call_sid, status: 'marked_error' });
        }
      } catch (error) {
        console.error(`[Watchdog] Error processing stuck call ${(call as any).twilio_call_sid}:`, error);
        results.push({ callSid: (call as any).twilio_call_sid, status: 'error', error: error instanceof Error ? error.message : 'Unknown' });
      }
    }

    return NextResponse.json({
      message: `Processed ${stuckCalls.length} stuck calls`,
      count: stuckCalls.length,
      results,
    });
  } catch (error) {
    console.error('[Watchdog] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

