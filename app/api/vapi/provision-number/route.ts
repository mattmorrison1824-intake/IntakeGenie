import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { buildVapiAgent } from '@/lib/vapi/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { firmId } = await req.json();

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

    // Check if phone number already exists - don't provision again
    if (firm.vapi_phone_number) {
      return NextResponse.json({ 
        phoneNumber: firm.vapi_phone_number,
        assistantId: firm.vapi_assistant_id,
        message: 'Phone number already provisioned'
      });
    }

    // Get app URL for webhook (production only)
    // Prefer VERCEL_URL (automatically set by Vercel) or NEXT_PUBLIC_APP_URL
    let appUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      return NextResponse.json({ 
        error: 'App URL not configured. Set NEXT_PUBLIC_APP_URL or deploy to Vercel.' 
      }, { status: 500 });
    }

    // Ensure URL has https:// protocol
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const webhookUrl = `${appUrl}/api/vapi/webhook`;

    // Build agent configuration
    const agentConfig = buildVapiAgent(
      firm.firm_name || 'the firm',
      firm.ai_greeting_custom,
      firm.ai_tone,
      firm.ai_knowledge_base
    );

    // Create assistant first
    let assistantResponse;
    try {
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
      };
      
      // Add stopSpeakingPlan to prevent interruptions
      if ((agentConfig as any).stopSpeakingPlan) {
        assistantPayload.stopSpeakingPlan = (agentConfig as any).stopSpeakingPlan;
      }
      // Note: Call ending handled via webhook when agent says goodbye
      
      console.log('[Vapi Provision] Creating assistant with payload:', JSON.stringify(assistantPayload, null, 2));
      
      // Vapi API uses /assistant (singular) endpoint
      assistantResponse = await vapi.post('/assistant', assistantPayload);
      
      console.log('[Vapi Provision] Assistant created successfully:', assistantResponse.data);
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      console.error('[Vapi Provision] Assistant creation error:', errorDetails);
      console.error('[Vapi Provision] Full error:', vapiError);
      console.error('[Vapi Provision] Error status:', vapiError?.response?.status);
      console.error('[Vapi Provision] Error headers:', vapiError?.response?.headers);
      
      return NextResponse.json({ 
        error: 'Failed to create assistant',
        details: errorDetails,
        status: vapiError?.response?.status,
        message: vapiError?.response?.data?.message || vapiError?.message
      }, { status: 500 });
    }

    const assistantId = assistantResponse.data.id;
    if (!assistantId) {
      console.error('[Vapi Provision] No assistant ID in response:', assistantResponse.data);
      return NextResponse.json({ 
        error: 'Failed to create assistant',
        details: 'No assistant ID returned',
        response: assistantResponse.data
      }, { status: 500 });
    }

    // Step 1: Create phone number with provider and assistantId
    // According to Vapi docs, assistantId can be included in initial creation
    let phoneResponse;
    let phoneNumberId: string;
    // Declare phonePayload outside try block so it's accessible in catch
    // NOTE: Free Vapi numbers are disabled for production use
    // Use /api/telephony/provision instead which purchases Twilio numbers and imports to Vapi
    const phonePayload: any = {
      provider: 'vapi', // DEPRECATED: Free Vapi numbers - use Twilio + Vapi import instead
      assistantId: assistantId,
    };
    
    // Return error for production - free numbers cause async issues
    return NextResponse.json({
      error: 'Free Vapi number provisioning is disabled',
      message: 'Please use the new phone number provisioning which purchases Twilio numbers and imports them into Vapi. This ensures immediate number assignment and reliable operation.',
      useEndpoint: '/api/telephony/provision',
    }, { status: 400 });
    
    try {
      console.log('[Vapi Provision] Creating phone number with assistant...');
      console.log('[Vapi Provision] Payload:', JSON.stringify(phonePayload, null, 2));
      
      phoneResponse = await vapi.post('/phone-number', phonePayload);
      console.log('[Vapi Provision] Phone number created:', phoneResponse.data);
      phoneNumberId = phoneResponse.data.id;
      
      if (!phoneNumberId) {
        console.error('[Vapi Provision] No phone number ID in response:', phoneResponse.data);
        return NextResponse.json({ 
          error: 'Failed to provision number',
          details: 'No phone number ID returned',
          response: phoneResponse.data
        }, { status: 500 });
      }
      
      // Step 2: Poll phone number status and ensure assistant is assigned
      // For free Vapi numbers, the number is assigned asynchronously
      // We'll poll to check if number is ready, then verify/assign assistant
      console.log('[Vapi Provision] Polling phone number status to ensure assistant assignment...');
      
      let assistantAssigned = false;
      const maxAttempts = 10; // Try for up to 30 seconds (10 attempts * 3 seconds)
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between attempts
          
          console.log(`[Vapi Provision] Checking phone number status (attempt ${attempt}/${maxAttempts})...`);
          const getResponse = await vapi.get(`/phone-number/${phoneNumberId}`);
          const phoneData = getResponse.data;
          
          console.log('[Vapi Provision] Phone number data:', JSON.stringify(phoneData, null, 2));
          
          // Check if number is assigned (has a valid number field)
          const hasNumber = phoneData.number && typeof phoneData.number === 'string' && phoneData.number.match(/^\+?[1-9]\d{1,14}$/);
          
          // Check if assistant is already assigned
          if (phoneData.assistantId === assistantId) {
            console.log('[Vapi Provision] Assistant already assigned!');
            assistantAssigned = true;
            break;
          }
          
          // If number is ready but assistant isn't assigned, try to assign it
          if (hasNumber && !phoneData.assistantId) {
            console.log('[Vapi Provision] Number is ready, assigning assistant...');
            try {
              await vapi.patch(`/phone-number/${phoneNumberId}`, { 
                assistantId: assistantId 
              });
              console.log('[Vapi Provision] Assistant assigned successfully!');
              assistantAssigned = true;
              break;
            } catch (patchError: any) {
              console.warn('[Vapi Provision] PATCH failed, will retry:', patchError?.response?.data || patchError?.message);
              // Continue polling
            }
          } else if (!hasNumber) {
            console.log('[Vapi Provision] Number not ready yet, continuing to poll...');
          }
        } catch (pollError: any) {
          console.warn(`[Vapi Provision] Error polling (attempt ${attempt}):`, pollError?.response?.data || pollError?.message);
          // Continue polling
        }
      }
      
      if (!assistantAssigned) {
        console.warn('[Vapi Provision] Could not assign assistant after polling - number may still be processing');
        console.warn('[Vapi Provision] Assistant will be assigned automatically when number is ready, or can be configured via dashboard');
      } else {
        console.log('[Vapi Provision] Phone number provisioned and assistant assigned successfully!');
      }
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      const errorStatus = vapiError?.response?.status || 500;
      
      console.error('[Vapi Provision] ========== PHONE NUMBER CREATION ERROR ==========');
      console.error('[Vapi Provision] Error status:', errorStatus);
      console.error('[Vapi Provision] Error details:', JSON.stringify(errorDetails, null, 2));
      console.error('[Vapi Provision] Full error object:', vapiError);
      console.error('[Vapi Provision] Request payload that failed:', JSON.stringify(phonePayload, null, 2));
      
      // Extract error message - handle array format
      let errorMessage = 'Unknown error';
      if (errorDetails) {
        if (typeof errorDetails === 'string') {
          errorMessage = errorDetails;
        } else if (errorDetails.message) {
          if (Array.isArray(errorDetails.message)) {
            errorMessage = errorDetails.message.join(', ');
          } else {
            errorMessage = errorDetails.message;
          }
        } else if (errorDetails.error) {
          errorMessage = errorDetails.error;
        }
      }
      
      return NextResponse.json({ 
        error: 'Failed to provision phone number',
        details: errorDetails,
        status: errorStatus,
        message: errorMessage,
        requestPayload: phonePayload, // Include for debugging
      }, { status: errorStatus });
    }

    // Step 3: Fetch the phone number details to get the actual number
    // Vapi may assign numbers asynchronously, so we check multiple times with delays
    let phoneNumber: string | null = null;
    
    // Try fetching the number with increasing delays (Vapi may need time to assign)
    for (const delay of [1000, 3000, 5000]) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`[Vapi Provision] Fetching phone number details (attempt after ${delay}ms)...`);
        const getResponse = await vapi.get(`/phone-number/${phoneNumberId}`);
        console.log('[Vapi Provision] Phone number details:', JSON.stringify(getResponse.data, null, 2));
        
        const data = getResponse.data;
        
        // According to Vapi API docs, the phone number is at the top-level "number" field
        // Also check fallbackDestination.number as fallback
        phoneNumber = 
          (data.number && typeof data.number === 'string' && data.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.number : // Top-level number (E.164 format)
          (data.fallbackDestination?.number && typeof data.fallbackDestination.number === 'string' && data.fallbackDestination.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.fallbackDestination.number : // Fallback destination number
          null;
        
        if (phoneNumber) {
          console.log('[Vapi Provision] Found phone number:', phoneNumber);
          break; // Found it, stop trying
        }
      } catch (vapiError: any) {
        console.error(`[Vapi Provision] Error fetching phone number (attempt ${delay}ms):`, vapiError?.response?.data || vapiError?.message);
      }
    }
    
    // If still no number, Vapi free numbers don't expose the number via API
    // The number will be available in the dashboard and will come through webhooks
    if (!phoneNumber) {
      console.warn('[Vapi Provision] Vapi free phone numbers do not expose the number via API.');
      console.warn('[Vapi Provision] Phone number ID:', phoneNumberId);
      console.warn('[Vapi Provision] The number will be visible in the Vapi dashboard and will be captured from webhooks when calls are received.');
      // Store a user-friendly placeholder - the actual number will be updated via webhook
      phoneNumber = `Pending - Check Dashboard (ID: ${phoneNumberId.substring(0, 8)}...)`;
    }

    // Save phone number and assistant ID to firm record
    const { error: updateError } = await supabase
      .from('firms')
      // @ts-ignore
      .update({ 
        vapi_phone_number: phoneNumber,
        vapi_assistant_id: assistantId,
      })
      .eq('id', firmId);

    if (updateError) {
      console.error('[Vapi Provision] Error updating firm:', updateError);
      return NextResponse.json({ error: 'Failed to save number' }, { status: 500 });
    }

    return NextResponse.json({ phoneNumber, assistantId });
  } catch (error: any) {
    console.error('[Vapi Provision] Unexpected error:', error);
    console.error('[Vapi Provision] Error stack:', error?.stack);
    console.error('[Vapi Provision] Error response:', error?.response?.data);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error',
        type: error?.constructor?.name
      },
      { status: 500 }
    );
  }
}

