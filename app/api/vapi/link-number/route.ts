import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { buildVapiAgent } from '@/lib/vapi/agent';
import { cleanVapiPayload } from '@/lib/vapi/utils';

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

    // Step 1: Create or get assistant
    let assistantId = firm.vapi_assistant_id;
    
    if (!assistantId) {
      // Create assistant
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
      console.log('[Link Number] Fetching phone number details for ID:', phoneNumberId);
      const getResponse = await vapi.get(`/phone-number/${phoneNumberId}`);
      const data = getResponse.data;
      
      console.log('[Link Number] Phone number details:', JSON.stringify(data, null, 2));
      
      // Extract phone number
      phoneNumber = 
        (data.number && typeof data.number === 'string' && data.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.number :
        (data.fallbackDestination?.number && typeof data.fallbackDestination.number === 'string' && data.fallbackDestination.number.match(/^\+?[1-9]\d{1,14}$/)) ? data.fallbackDestination.number :
        null;
      
      console.log('[Link Number] Extracted number:', phoneNumber);
      
      // Update phone number to assign assistant (webhook is already on assistant)
      console.log('[Link Number] Updating phone number with assistantId:', assistantId);
      const patchPayload = cleanVapiPayload({ assistantId: assistantId });
      await vapi.patch(`/phone-number/${phoneNumberId}`, patchPayload);
      console.log('[Link Number] Phone number updated with assistant');
      
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      const statusCode = vapiError?.response?.status || 500;
      console.error('[Link Number] Error linking phone number:', errorDetails);
      console.error('[Link Number] Error status:', statusCode);
      console.error('[Link Number] Full error:', JSON.stringify(errorDetails, null, 2));
      
      // Return more detailed error information
      // Vapi often returns validation errors as arrays in the message field
      const errorMessage = typeof errorDetails === 'object' && errorDetails?.message 
        ? (Array.isArray(errorDetails.message) ? errorDetails.message.join(', ') : errorDetails.message)
        : (typeof errorDetails === 'string' ? errorDetails : 'Unknown error');
      
      return NextResponse.json({ 
        error: 'Failed to link phone number',
        details: errorDetails,
        message: errorMessage,
        statusCode: statusCode
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

