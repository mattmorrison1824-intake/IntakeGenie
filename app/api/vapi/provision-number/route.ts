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

    // Get app URL for webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
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
      const assistantPayload = {
        name: `${firm.firm_name} Intake Assistant`,
        model: agentConfig.model,
        voice: agentConfig.voice,
        transcriber: agentConfig.transcriber,
        firstMessage: agentConfig.firstMessage,
        // Note: Vapi doesn't support systemMessage/systemPrompt field
        // The system prompt context is embedded in firstMessage
        server: {
          url: webhookUrl,
        },
      };
      
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

    // Step 1: Create phone number with provider and assistant/server in one request
    // For Vapi free numbers, we can include assistantId and server in the initial creation
    let phoneResponse;
    let phoneNumberId: string;
    try {
      console.log('[Vapi Provision] Creating phone number with provider, assistant, and server...');
      const phonePayload: any = {
        provider: 'vapi', // Use Vapi's free phone number service
        assistantId: assistantId,
      };
      
      // Include server URL if provided
      if (webhookUrl) {
        phonePayload.server = {
          url: webhookUrl,
        };
      }
      
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
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      console.error('[Vapi Provision] Phone number creation error:', errorDetails);
      console.error('[Vapi Provision] Full error response:', JSON.stringify(errorDetails, null, 2));
      
      // If creation with assistant fails, try creating without assistant first
      if (errorDetails?.message?.includes('phone number') || errorDetails?.statusCode === 400) {
        console.log('[Vapi Provision] Retrying phone number creation without assistant/server...');
        try {
          phoneResponse = await vapi.post('/phone-number', {
            provider: 'vapi',
          });
          phoneNumberId = phoneResponse.data.id;
          console.log('[Vapi Provision] Phone number created without assistant:', phoneResponse.data);
          
          // Now try to update with assistant and server
          if (phoneNumberId) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              const updatePayload: any = { assistantId: assistantId };
              if (webhookUrl) {
                updatePayload.server = { url: webhookUrl };
              }
              await vapi.patch(`/phone-number/${phoneNumberId}`, updatePayload);
              console.log('[Vapi Provision] Phone number updated with assistant and server');
            } catch (updateError: any) {
              console.warn('[Vapi Provision] Could not update phone number with assistant:', updateError?.response?.data || updateError?.message);
              // Continue - phone number is created, can be configured later
            }
          }
        } catch (retryError: any) {
          return NextResponse.json({ 
            error: 'Failed to provision phone number',
            details: retryError?.response?.data || retryError?.message || 'Unknown error'
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Failed to provision phone number',
          details: errorDetails
        }, { status: 500 });
      }
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

