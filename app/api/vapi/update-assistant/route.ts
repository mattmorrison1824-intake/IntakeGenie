import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { buildVapiAgent } from '@/lib/vapi/agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Update an existing Vapi assistant with new settings
 * Called when AI Receptionist settings or Knowledge Base are updated
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

    // Check if assistant exists
    if (!firm.vapi_assistant_id) {
      return NextResponse.json({ 
        error: 'No assistant found',
        message: 'Assistant must be created first by provisioning a phone number'
      }, { status: 400 });
    }

    // Get app URL for webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
    }

    const webhookUrl = `${appUrl}/api/vapi/webhook`;

    // Build updated agent configuration
    const agentConfig = buildVapiAgent(
      firm.firm_name || 'the firm',
      firm.ai_greeting_custom,
      firm.ai_tone,
      firm.ai_knowledge_base
    );

    // Update assistant with new configuration
    // Vapi PATCH: Include all fields that should be updated
    // According to Vapi docs, when updating nested objects, include the complete object
    try {
      // Build the update payload - include all configuration fields
      const assistantPayload: any = {
        model: agentConfig.model, // Complete model object with messages
        voice: agentConfig.voice, // Voice configuration
        transcriber: agentConfig.transcriber, // Transcriber configuration
        firstMessage: agentConfig.firstMessage, // Updated greeting
      };
      
      // Add stopSpeakingPlan to prevent interruptions
      if ((agentConfig as any).stopSpeakingPlan) {
        assistantPayload.stopSpeakingPlan = (agentConfig as any).stopSpeakingPlan;
      }
      
      // Ensure metadata includes firmId for webhook resolution
      assistantPayload.metadata = {
        firmId: firmId,
      };
      
      // Ensure server webhook URL is set
      assistantPayload.server = {
        url: webhookUrl,
      };
      
      // Ensure serverMessages includes events we need for transcript/data
      assistantPayload.serverMessages = [
        'status-update',
        'end-of-call-report',
        'function-call',
        'transcript',
      ];
      
      // Enable recording
      assistantPayload.artifactPlan = {
        recordingEnabled: true,
      };
      
      console.log('[Update Assistant] Updating assistant:', firm.vapi_assistant_id);
      console.log('[Update Assistant] Payload:', JSON.stringify(assistantPayload, null, 2));
      
      const updateResponse = await vapi.patch(`/assistant/${firm.vapi_assistant_id}`, assistantPayload);
      
      console.log('[Update Assistant] Assistant updated successfully:', updateResponse.data);
      
      return NextResponse.json({ 
        success: true,
        message: 'Assistant updated successfully',
        assistantId: firm.vapi_assistant_id
      });
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message || vapiError;
      console.error('[Update Assistant] Error updating assistant:', errorDetails);
      console.error('[Update Assistant] Full error:', vapiError);
      
      // Return more detailed error information
      const errorMessage = typeof errorDetails === 'object' && errorDetails?.message 
        ? (Array.isArray(errorDetails.message) ? errorDetails.message.join(', ') : errorDetails.message)
        : (typeof errorDetails === 'string' ? errorDetails : 'Unknown error');
      
      return NextResponse.json({ 
        error: 'Failed to update assistant',
        details: errorDetails,
        status: vapiError?.response?.status || 500,
        message: errorMessage
      }, { status: vapiError?.response?.status || 500 });
    }
  } catch (error: any) {
    console.error('[Update Assistant] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

