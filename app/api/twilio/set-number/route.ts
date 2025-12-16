import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/clients/supabase';
import { normalizeAppUrl } from '@/lib/clients/twilio';
import twilio from 'twilio';

// Handle OPTIONS for CORS
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
    const { firmId, phoneNumber } = await request.json();

    if (!firmId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Firm ID and phone number are required' },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164)
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must be E.164 format (e.g., +15551234567)' },
        { status: 400 }
      );
    }

    // Validate Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    // Verify user is authenticated
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Verify firm exists and user owns it
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, owner_user_id, twilio_number')
      .eq('id', firmId)
      .eq('owner_user_id', session.user.id)
      .single();

    if (firmError || !firmData) {
      return NextResponse.json(
        { error: 'Firm not found or you do not have permission to modify it' },
        { status: 404 }
      );
    }

    const firm = firmData as any;

    // Initialize Twilio client
    const twilioClient = twilio(accountSid, authToken);

    // Verify the number exists in the Twilio account
    try {
      const incomingNumbers = await twilioClient.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber,
        limit: 1,
      });

      if (incomingNumbers.length === 0) {
        return NextResponse.json(
          { error: 'Phone number not found in your Twilio account. Make sure the number exists and belongs to your account.' },
          { status: 404 }
        );
      }

      // Get app URL for webhook configuration
      const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
      if (!appUrl) {
        return NextResponse.json(
          { error: 'NEXT_PUBLIC_APP_URL not configured' },
          { status: 500 }
        );
      }

      // Configure webhooks for the number
      // Note: For localhost HTTP, Twilio may reject it, but we'll try anyway
      const voiceUrl = `${appUrl}/api/twilio/voice`;
      const statusUrl = `${appUrl}/api/twilio/status`;

      await twilioClient.incomingPhoneNumbers(incomingNumbers[0].sid).update({
        voiceUrl: voiceUrl,
        voiceMethod: 'POST',
        statusCallback: statusUrl,
        statusCallbackMethod: 'POST',
      });

      // Store the number in the database (use service client to bypass RLS)
      const serviceSupabase = createServiceClient();
      const { error: updateError } = await serviceSupabase
        .from('firms')
        // @ts-ignore - Supabase type inference issue
        .update({ twilio_number: phoneNumber })
        // @ts-ignore - Supabase type inference issue
        .eq('id', firmId);

      if (updateError) {
        console.error('Error updating firm with Twilio number:', updateError);
        return NextResponse.json(
          { error: 'Failed to save phone number to database' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        phoneNumber,
        message: 'Twilio number configured successfully',
      });
    } catch (twilioError: any) {
      console.error('Twilio API error:', twilioError);
      
      // If it's a webhook URL error, still save the number but warn the user
      if (twilioError.message && twilioError.message.includes('not valid')) {
        // Use service client for database update (bypasses RLS)
        const serviceSupabase = createServiceClient();
        // Still save the number to database
        const { error: updateError } = await serviceSupabase
          .from('firms')
          // @ts-ignore - Supabase type inference issue
          .update({ twilio_number: phoneNumber })
          // @ts-ignore - Supabase type inference issue
          .eq('id', firmId);

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to save phone number to database' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          phoneNumber,
          warning: 'Number saved but webhooks may not be configured. Twilio requires HTTPS URLs. For local development, use ngrok.',
          message: 'Twilio number saved (webhook configuration may need HTTPS)',
        });
      }

      throw twilioError;
    }
  } catch (error: any) {
    console.error('Error setting Twilio number:', error);
    
    let errorMessage = 'Failed to set Twilio number';
    if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

