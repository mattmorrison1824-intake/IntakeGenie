import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { buildVapiAgent } from '@/lib/vapi/agent';
import { cleanVapiPayload } from '@/lib/vapi/utils';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Provision a phone number for a firm:
 * 1. Purchase a Twilio phone number
 * 2. Import it into Vapi
 * 3. Assign the Vapi assistant to it
 * 4. Save all details to the firm record
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { firmId, areaCode } = await req.json();

    if (!firmId) {
      return NextResponse.json({ error: 'Missing firmId' }, { status: 400 });
    }

    // Verify user owns the firm and get firm data
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    if (firmError || !firmData || (firmData as any).owner_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const firm = firmData as any;

    // Check if phone number already exists - prevent duplicate provisioning
    if (firm.inbound_number_e164 || firm.vapi_phone_number_id || firm.twilio_phone_number_sid) {
      return NextResponse.json({
        error: 'Phone number already provisioned',
        message: 'This firm already has a phone number. Only one number can be provisioned per firm.',
        phoneNumber: firm.inbound_number_e164,
        vapiPhoneNumberId: firm.vapi_phone_number_id,
        twilioPhoneNumberSid: firm.twilio_phone_number_sid,
      }, { status: 409 }); // 409 Conflict - resource already exists
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

    // Get app URL for webhook
    let appUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      return NextResponse.json({ 
        error: 'App URL not configured. Set NEXT_PUBLIC_APP_URL or deploy to Vercel.' 
      }, { status: 500 });
    }

    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const webhookUrl = `${appUrl}/api/vapi/webhook`;

    // Step 1: Create or get Vapi assistant
    console.log('[Telephony Provision] Step 1: Creating/getting Vapi assistant...');
    let assistantId = firm.vapi_assistant_id;

    if (!assistantId) {
      const agentConfig = buildVapiAgent(
        firm.firm_name || 'the firm',
        firm.ai_greeting_custom,
        firm.ai_tone,
        firm.ai_knowledge_base
      );

      const assistantPayload: any = {
        name: `${firm.firm_name} Intake Assistant`,
        model: agentConfig.model,
        voice: agentConfig.voice,
        transcriber: agentConfig.transcriber,
        firstMessage: agentConfig.firstMessage,
        server: {
          url: webhookUrl,
        },
        serverMessages: [
          'status-update',
          'end-of-call-report',
          'function-call',
          'transcript',
        ],
        artifactPlan: {
          recordingEnabled: true,
        },
        metadata: {
          firmId: firmId,
        },
        stopSpeakingPlan: agentConfig.stopSpeakingPlan,
      };

      try {
        const assistantResponse = await vapi.post('/assistant', assistantPayload);
        assistantId = assistantResponse.data.id;
        console.log('[Telephony Provision] Assistant created:', assistantId);
      } catch (vapiError: any) {
        const errorDetails = vapiError?.response?.data || vapiError?.message;
        console.error('[Telephony Provision] Assistant creation error:', errorDetails);
        return NextResponse.json({
          error: 'Failed to create assistant',
          details: errorDetails,
        }, { status: 500 });
      }
    } else {
      console.log('[Telephony Provision] Using existing assistant:', assistantId);
    }

    // Step 2: Purchase Twilio phone number
    console.log('[Telephony Provision] Step 2: Purchasing Twilio phone number...');
    const twilioClient = twilio(accountSid, authToken);

    let purchasedNumber;
    try {
      // Search for available numbers
      const searchParams: any = {
        limit: 1,
        voiceEnabled: true,
      };

      if (areaCode) {
        searchParams.areaCode = areaCode;
        console.log('[Telephony Provision] Searching for numbers with area code:', areaCode);
      }

      const searchResults = await twilioClient.availablePhoneNumbers('US')
        .local.list(searchParams);

      if (searchResults.length === 0) {
        return NextResponse.json(
          { error: 'No available phone numbers found' + (areaCode ? ` for area code ${areaCode}` : '') },
          { status: 500 }
        );
      }

      // Purchase the number (don't set webhooks - Vapi will handle that)
      purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber: searchResults[0].phoneNumber,
        // Note: We don't set voiceUrl here - Vapi will configure it when we import
      });

      console.log('[Telephony Provision] Twilio number purchased:', purchasedNumber.phoneNumber);
      console.log('[Telephony Provision] Twilio SID:', purchasedNumber.sid);
    } catch (twilioError: any) {
      console.error('[Telephony Provision] Twilio purchase error:', twilioError);
      return NextResponse.json({
        error: 'Failed to purchase Twilio number',
        details: twilioError.message || 'Unknown error',
      }, { status: 500 });
    }

    const twilioPhoneNumber = purchasedNumber.phoneNumber; // E.164 format
    const twilioSid = purchasedNumber.sid;

    // Step 3: Import Twilio number into Vapi
    // According to Vapi Postman docs: https://www.postman.com/vapiai/public-workspace/request/l2eelnz/import-twilio-number
    // Use the specific import endpoint: /phone-number/import/twilio
    // This endpoint accepts credentials directly - no need to create credential separately
    console.log('[Telephony Provision] Step 3: Importing Twilio number into Vapi...');
    let vapiPhoneNumberId: string;
    // Declare importPayload outside try block for error logging
    let importPayload: any = null;
    
    try {
      // Build import payload according to Vapi API spec
      // The import endpoint expects: number (E.164), twilioAccountSid, twilioAuthToken
      importPayload = cleanVapiPayload({
        number: twilioPhoneNumber, // E.164 format (e.g., +15551234567)
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken,
      });

      console.log('[Telephony Provision] Vapi import payload:', JSON.stringify(importPayload, null, 2));

      // Use the specific Twilio import endpoint as per Postman docs
      const importResponse = await vapi.post('/phone-number/import/twilio', importPayload);
      vapiPhoneNumberId = importResponse.data.id;

      if (!vapiPhoneNumberId) {
        throw new Error('No phone number ID returned from Vapi import');
      }

      console.log('[Telephony Provision] Vapi import successful. Phone number ID:', vapiPhoneNumberId);
      console.log('[Telephony Provision] Vapi import response:', JSON.stringify(importResponse.data, null, 2));
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message;
      const errorStatus = vapiError?.response?.status || 500;
      
      console.error('[Telephony Provision] ========== VAPI IMPORT ERROR ==========');
      console.error('[Telephony Provision] Error status:', errorStatus);
      console.error('[Telephony Provision] Error details:', JSON.stringify(errorDetails, null, 2));
      console.error('[Telephony Provision] Full error:', JSON.stringify(vapiError, null, 2));
      if (importPayload) {
        console.error('[Telephony Provision] Request payload:', JSON.stringify(importPayload, null, 2));
      }
      
      // If import fails, we should clean up the Twilio number
      try {
        await twilioClient.incomingPhoneNumbers(twilioSid).remove();
        console.log('[Telephony Provision] Cleaned up Twilio number after import failure');
      } catch (cleanupError) {
        console.error('[Telephony Provision] Failed to cleanup Twilio number:', cleanupError);
      }

      // Extract detailed error message
      let errorMessage = 'Failed to import number into Vapi';
      if (errorDetails) {
        if (typeof errorDetails === 'string') {
          errorMessage = errorDetails;
        } else if (errorDetails.message) {
          errorMessage = Array.isArray(errorDetails.message) 
            ? errorDetails.message.join(', ')
            : errorDetails.message;
        } else if (errorDetails.error) {
          errorMessage = errorDetails.error;
        }
      }

      return NextResponse.json({
        error: 'Failed to import number into Vapi',
        message: errorMessage,
        details: errorDetails,
        status: errorStatus,
      }, { status: 500 });
    }

    // Step 4: Verify assistant is assigned (may need to assign if not included in import)
    console.log('[Telephony Provision] Step 4: Verifying assistant assignment...');
    try {
      const getResponse = await vapi.get(`/phone-number/${vapiPhoneNumberId}`);
      const phoneData = getResponse.data;

      if (phoneData.assistantId !== assistantId) {
        console.log('[Telephony Provision] Assistant not assigned, assigning now...');
        const patchPayload = cleanVapiPayload({
          assistantId: assistantId,
        });

        await vapi.patch(`/phone-number/${vapiPhoneNumberId}`, patchPayload);
        console.log('[Telephony Provision] Assistant assigned successfully');
      } else {
        console.log('[Telephony Provision] Assistant already assigned');
      }
    } catch (verifyError: any) {
      console.warn('[Telephony Provision] Could not verify/assign assistant:', verifyError?.response?.data || verifyError?.message);
      // Continue - assistant may be assigned via import
    }

    // Step 5: Save to database
    console.log('[Telephony Provision] Step 5: Saving to database...');
    const { error: updateError } = await supabase
      .from('firms')
      // @ts-ignore
      .update({
        inbound_number_e164: twilioPhoneNumber,
        twilio_phone_number_sid: twilioSid,
        vapi_phone_number_id: vapiPhoneNumberId,
        vapi_assistant_id: assistantId,
        telephony_provider: 'twilio_imported_into_vapi',
      })
      .eq('id', firmId);

    if (updateError) {
      console.error('[Telephony Provision] Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to save to database' }, { status: 500 });
    }

    console.log('[Telephony Provision] ✅ Provisioning complete!');
    console.log('[Telephony Provision] Phone number:', twilioPhoneNumber);
    console.log('[Telephony Provision] Vapi phone number ID:', vapiPhoneNumberId);

    return NextResponse.json({
      success: true,
      phoneNumber: twilioPhoneNumber,
      vapiPhoneNumberId,
      assistantId,
      message: 'Phone number provisioned successfully',
    });
  } catch (error: any) {
    console.error('[Telephony Provision] Unexpected error:', error);
    console.error('[Telephony Provision] Error stack:', error?.stack);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

