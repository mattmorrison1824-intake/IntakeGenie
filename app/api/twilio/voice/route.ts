import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { generateTwiML, twilioNumber } from '@/lib/clients/twilio';
import { isBusinessHoursOpen } from '@/lib/utils/business-hours';
import { twiml } from 'twilio';

// Ensure this route is public (no authentication required)
export const dynamic = 'force-dynamic';

// Explicitly allow POST and OPTIONS methods
export const runtime = 'nodejs';

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
  console.log('[Twilio Voice] POST request received');
  try {
    const formData = await request.formData();
    console.log('[Twilio Voice] FormData parsed successfully');
    const callSid = formData.get('CallSid') as string;
    const fromNumber = formData.get('From') as string;
    const toNumber = formData.get('To') as string;

    if (!callSid || !fromNumber || !toNumber) {
      return generateTwiML(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call. Please try again later.</Say><Hangup/></Response>'
      );
    }

    const supabase = createServiceClient();

    // Identify firm by To number (the Twilio number that received the call)
    let firm: any;
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('twilio_number', toNumber)
      .single();

    if (firmError || !firmData) {
      console.error('Firm lookup error:', firmError);
      // Fallback: try legacy env var approach for backward compatibility
      if (process.env.FIRM_ID) {
        const { data: fallbackFirm, error: fallbackError } = await supabase
          .from('firms')
          .select('*')
          .eq('id', process.env.FIRM_ID)
          .single();

        if (fallbackError || !fallbackFirm) {
          return generateTwiML(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service configuration error. Please contact support.</Say><Hangup/></Response>'
          );
        }
        firm = fallbackFirm;
      } else {
        return generateTwiML(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service configuration error. Please contact support.</Say><Hangup/></Response>'
        );
      }
    } else {
      firm = firmData;
    }

    // Determine routing
    const isOpen = isBusinessHoursOpen(firm);
    const routeReason = isOpen ? 'no_answer' : 'after_hours';

    // Create call record
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      // @ts-ignore - Supabase type inference issue
      .insert({
        firm_id: firm.id,
        twilio_call_sid: callSid,
        from_number: fromNumber,
        to_number: toNumber,
        route_reason: routeReason,
        status: 'in_progress',
        urgency: 'normal',
      })
      .select()
      .single();

    if (callError) {
      console.error('Error creating call record:', callError);
    }

    const response = new twiml.VoiceResponse();

    // Routing logic
    if (!isOpen && (firm.mode === 'after_hours' || firm.mode === 'both')) {
      // After hours - route directly to agent
      // Use redirect to stream endpoint which handles Gather flow
      response.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/stream?callSid=${callSid}&firmId=${firm.id}`
      );
    } else if (isOpen && (firm.mode === 'failover' || firm.mode === 'both')) {
      // Business hours - try to forward, with failover to agent
      const dial = response.dial({
        timeout: firm.failover_ring_seconds,
        action: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/failover?firmId=${firm.id}&callSid=${callSid}`,
        method: 'POST',
        record: 'record-from-answer',
      });
      dial.number(firm.forward_to_number);
    } else if (isOpen && firm.mode === 'after_hours') {
      // Business hours but only after-hours mode enabled - just forward
      const dial = response.dial({
        record: 'record-from-answer',
      });
      dial.number(firm.forward_to_number);
    } else {
      // Closed and no after-hours mode - hang up
      response.say(
        { voice: 'alice' },
        'Our office is currently closed. Please call back during business hours.'
      );
      response.hangup();
    }

    return generateTwiML(response.toString());
  } catch (error) {
    console.error('Error in voice webhook:', error);
    return generateTwiML(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>'
    );
  }
}

