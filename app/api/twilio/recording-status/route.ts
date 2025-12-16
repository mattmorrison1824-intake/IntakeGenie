import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';

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
    const callSid = request.nextUrl.searchParams.get('callSid');
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingSid = formData.get('RecordingSid') as string;

    if (callSid && recordingUrl) {
      const supabase = createServiceClient();
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ recording_url: recordingUrl })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);
    }

    return new NextResponse('OK', { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in recording status callback:', error);
    return new NextResponse('Error', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

