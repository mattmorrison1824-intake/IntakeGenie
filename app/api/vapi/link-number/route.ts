import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { buildVapiAgent } from '@/lib/vapi/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Link an existing Vapi phone number to a firm
 * This is useful when you have a phone number already in Vapi (e.g., imported from Twilio)
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

    const { firmId, phoneNumberId } = await req.json();

    if (!firmId || !phoneNumberId) {
      return NextResponse.json({ error: 'Missing firmId or phoneNumberId' }, { status: 400 });
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

    // Step 1: Create or get assistant
    let assistantId = firm.vapi_assistant_id;
    
    if (!assistantId) {
      // Create assistant
      try {
        const assistantPayload = {
          name: `${firm.firm_name} Intake Assistant`,
          model: agentConfig.model,
          voice: agentConfig.voice,
          transcriber: agentConfig.transcriber,
          firstMessage: agentConfig.firstMessage,
          server: {
            url: webhookUrl,
          },
        };
        
        const assistantResponse = await vapi.post('/assistant', assistantPayload);
        assistantId = assistantResponse.data.id;
        console.log('[Link Number] Assistant created:', assistantId);
      } catch (vapiError: any) {
        console.error('[Link Number] Assistant creation error:', vapiError?.response?.data || vapiError?.message);
        return NextResponse.json({ 
          error: 'Failed to create assistant',
          details: vapiError?.response?.data || vapiError?.message || 'Unknown error'
        }, { status: 500 });
      }
    }

    // Step 2: Get the phone number details to verify it exists and get the actual number
    let phoneNumber: string | null = null;
    try {
      const getResponse = await vapi.get(`/phone-number/${phoneNumberId}`);
      const data = getResponse.data;
      
      // Extract phone number
      phoneNumber = 
        (data.number && typeof data.number === 'string' && data.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.number :
        (data.fallbackDestination?.number && typeof data.fallbackDestination.number === 'string' && data.fallbackDestination.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.fallbackDestination.number :
        null;
      
      console.log('[Link Number] Phone number details:', JSON.stringify(data, null, 2));
      console.log('[Link Number] Extracted number:', phoneNumber);
      
      // Update phone number to assign assistant and server
      const updatePayload: any = {
        assistantId: assistantId,
      };
      
      if (webhookUrl) {
        updatePayload.server = {
          url: webhookUrl,
        };
      }
      
      await vapi.patch(`/phone-number/${phoneNumberId}`, updatePayload);
      console.log('[Link Number] Phone number updated with assistant and server');
      
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      console.error('[Link Number] Error linking phone number:', errorDetails);
      return NextResponse.json({ 
        error: 'Failed to link phone number',
        details: errorDetails
      }, { status: 500 });
    }

    // Step 3: Save to firm record
    const updateData: any = {
      vapi_assistant_id: assistantId,
    };
    
    // Use the actual phone number if we found it, otherwise use the ID
    if (phoneNumber) {
      updateData.vapi_phone_number = phoneNumber;
    } else {
      updateData.vapi_phone_number = phoneNumberId; // Store ID as fallback
    }
    
    const { error: updateError } = await supabase
      .from('firms')
      // @ts-ignore
      .update(updateData)
      .eq('id', firmId);

    if (updateError) {
      console.error('[Link Number] Error updating firm:', updateError);
      return NextResponse.json({ error: 'Failed to save to firm' }, { status: 500 });
    }

    return NextResponse.json({ 
      phoneNumber: phoneNumber || phoneNumberId,
      assistantId,
      message: 'Phone number linked successfully'
    });
  } catch (error: any) {
    console.error('[Link Number] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

