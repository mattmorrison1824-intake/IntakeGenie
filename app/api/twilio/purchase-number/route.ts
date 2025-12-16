import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { normalizeAppUrl } from '@/lib/clients/twilio';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const { firmId } = await request.json();

    if (!firmId) {
      return NextResponse.json(
        { error: 'Firm ID is required' },
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

    const supabase = createServiceClient();

    // Verify firm exists and get owner info
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, owner_user_id, twilio_number')
      .eq('id', firmId)
      .single();

    if (firmError || !firmData) {
      return NextResponse.json(
        { error: 'Firm not found' },
        { status: 404 }
      );
    }

    const firm = firmData as any;

    // If firm already has a number, return it
    if (firm.twilio_number) {
      return NextResponse.json({
        success: true,
        phoneNumber: firm.twilio_number,
        message: 'Firm already has a Twilio number',
      });
    }

    // Purchase a US phone number
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (!appUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL not configured' },
        { status: 500 }
      );
    }

    // Twilio requires HTTPS URLs (except for localhost in some cases)
    // Convert http://localhost to https for Twilio, or require HTTPS
    if (appUrl.startsWith('http://') && !appUrl.includes('localhost')) {
      return NextResponse.json(
        { 
          error: 'NEXT_PUBLIC_APP_URL must use HTTPS. For local development, use ngrok or similar to get an HTTPS URL.',
          hint: 'Example: https://your-domain.ngrok.io'
        },
        { status: 500 }
      );
    }

    // For localhost HTTP, we'll still try but Twilio may reject it
    // In production, this should always be HTTPS
    const voiceUrl = `${appUrl}/api/twilio/voice`;
    const statusUrl = `${appUrl}/api/twilio/status`;

    // Initialize Twilio client directly (not using proxy)
    const twilioClient = twilio(accountSid, authToken);

    // Search for available US numbers
    const searchResults = await twilioClient.availablePhoneNumbers('US')
      .local.list({
        limit: 1,
        voiceEnabled: true,
      });

    if (searchResults.length === 0) {
      return NextResponse.json(
        { error: 'No available phone numbers found' },
        { status: 500 }
      );
    }

    // Purchase the first available number and configure webhooks
    // Note: Twilio requires HTTPS URLs for webhooks
    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: searchResults[0].phoneNumber,
      voiceUrl: voiceUrl,
      voiceMethod: 'POST',
      statusCallback: statusUrl,
      statusCallbackMethod: 'POST',
    });

    const phoneNumber = purchasedNumber.phoneNumber;

    // Store the number in the database
    const { error: updateError } = await supabase
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
      message: 'Twilio number purchased and configured successfully',
    });
  } catch (error: any) {
    console.error('Error purchasing Twilio number:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to purchase Twilio number';
    let hint = '';
    
    if (error.message) {
      errorMessage = error.message;
      
      // Provide helpful hints for common errors
      if (error.message.includes('VoiceUrl is not valid') || error.message.includes('not valid')) {
        hint = 'Twilio requires HTTPS URLs for webhooks. For local development, use ngrok (https://ngrok.com) to get an HTTPS URL. Update NEXT_PUBLIC_APP_URL to use HTTPS.';
      } else if (error.code === 20003) {
        hint = 'Invalid Twilio credentials. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.';
      } else if (error.code === 21211) {
        hint = 'Invalid phone number format.';
      } else if (error.code === 21402) {
        hint = 'Invalid webhook URL. Twilio requires HTTPS URLs (except for localhost in some cases).';
      }
    } else if (error.code) {
      errorMessage = `Twilio error ${error.code}: ${error.message || 'Unknown error'}`;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        hint: hint || undefined,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

