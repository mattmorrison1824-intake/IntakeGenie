import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';

// Ensure this route is public (no authentication required)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Log incoming request for debugging
    console.log('[Twilio Status] Received status callback');
    
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;

    console.log('[Twilio Status] CallSid:', callSid, 'Status:', callStatus);

    if (!callSid) {
      console.error('[Twilio Status] Missing CallSid');
      // Always return 200 OK per Twilio requirements (15003, 11200)
      return new NextResponse('OK', { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const supabase = createServiceClient();

    // Update call ended_at when call completes
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ ended_at: new Date().toISOString() })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);

      // If call was handled by agent (status is in_progress or transcribing), trigger processing
      const { data: callData } = await supabase
        .from('calls')
        .select('status')
        .eq('twilio_call_sid', callSid)
        .single();

      const call = callData as any;
      if (call && (call.status === 'in_progress' || call.status === 'transcribing')) {
        // Trigger async processing (fire and forget)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/process-call?callSid=${callSid}`, {
          method: 'POST',
        }).catch((err) => console.error('Error triggering process-call:', err));
      }
    }

    return new NextResponse('OK', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in status callback:', error);
    // Return 200 OK even on error to prevent Twilio retries
    // Per Twilio docs: respond quickly with 2xx status
    return new NextResponse('OK', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

