import { NextRequest, NextResponse } from 'next/server';
import { generateTwiML, normalizeAppUrl, getTTSAudioUrl } from '@/lib/clients/twilio';
import { createServiceClient } from '@/lib/clients/supabase';
import { twiml } from 'twilio';

// Ensure this route is public (no authentication required)
export const dynamic = 'force-dynamic';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const dialCallStatus = formData.get('DialCallStatus') as string;
    const callSid = request.nextUrl.searchParams.get('callSid');
    const firmId = request.nextUrl.searchParams.get('firmId');

    const response = new twiml.VoiceResponse();

    // If the firm answered, hang up
    if (dialCallStatus === 'completed') {
      response.hangup();
      return generateTwiML(response.toString());
    }

    // Otherwise, route to agent
    if (callSid && firmId) {
      // Update call record with route reason
      const supabase = createServiceClient();
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ route_reason: 'no_answer' })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);

      const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
      response.redirect(
        `${appUrl}/api/twilio/stream?callSid=${callSid}&firmId=${firmId}&routeReason=no_answer`
      );
    } else {
      // Use premium TTS for hold message
      const holdText = 'Please hold while I connect you.';
      try {
        const { playUrl, fallbackText } = await getTTSAudioUrl(holdText, callSid || 'unknown', 'hold');
        if (playUrl) {
          response.play(playUrl);
        } else {
          response.say({ voice: 'alice' }, fallbackText);
        }
      } catch (error) {
        console.error('[Failover] TTS error, using fallback:', error);
        response.say({ voice: 'alice' }, holdText);
      }
      const connect = response.connect();
      const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
      connect.stream({
        url: `${appUrl}/api/twilio/stream?callSid=${callSid || ''}&firmId=${firmId || ''}`,
      });
    }

    return generateTwiML(response.toString());
  } catch (error) {
    console.error('Error in failover webhook:', error);
    return generateTwiML(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">An error occurred. Please try again later.</Say><Hangup/></Response>'
    );
  }
}

