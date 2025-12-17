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

    // Provision phone number with assistant and webhook
    let phoneResponse;
    try {
      // Vapi API uses /phone-number (singular) endpoint
      phoneResponse = await vapi.post('/phone-number', {
        assistantId: assistantId,
        server: {
          url: webhookUrl,
        },
      });
    } catch (vapiError: any) {
      console.error('[Vapi Provision] Phone number creation error:', vapiError?.response?.data || vapiError?.message || vapiError);
      return NextResponse.json({ 
        error: 'Failed to provision phone number',
        details: vapiError?.response?.data || vapiError?.message || 'Unknown error'
      }, { status: 500 });
    }

    const phoneNumber = phoneResponse.data.number || phoneResponse.data.phoneNumber;
    if (!phoneNumber) {
      console.error('[Vapi Provision] No phone number in response:', phoneResponse.data);
      return NextResponse.json({ 
        error: 'Failed to provision number',
        details: 'No phone number returned',
        response: phoneResponse.data
      }, { status: 500 });
    }

    // Save number and assistant ID to firm record
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

