import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { upsertCall, finalizeCall } from '@/lib/intake/processor';

// Ensure this route is public (no authentication required)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      conversation_id,
      event,
      transcript,
      structuredData,
      phoneNumber,
      metadata,
      phoneNumberId,
      phoneNumber: phoneNumberAlt, // Sometimes it's nested differently
    } = body;

    // Extract phone number from various possible locations
    const actualPhoneNumber = phoneNumber || phoneNumberAlt || body.phoneNumber?.number || body.phoneNumber;
    const actualPhoneNumberId = phoneNumberId || body.phoneNumber?.id || body.phoneNumberId;

    console.log('[Vapi Webhook] ========== WEBHOOK RECEIVED ==========');
    console.log('[Vapi Webhook] Event:', event);
    console.log('[Vapi Webhook] Conversation ID:', conversation_id);
    console.log('[Vapi Webhook] Phone Number:', actualPhoneNumber);
    console.log('[Vapi Webhook] Phone Number ID:', actualPhoneNumberId);
    console.log('[Vapi Webhook] Metadata:', JSON.stringify(metadata, null, 2));
    console.log('[Vapi Webhook] Full body keys:', Object.keys(body));
    console.log('[Vapi Webhook] Full body:', JSON.stringify(body, null, 2));

    const supabase = createServiceClient();

    // Look up firm by metadata first (most reliable)
    let firmId = metadata?.firmId || body.metadata?.firmId;
    
    if (!firmId) {
      // Try to extract from phoneNumber object if it exists
      if (actualPhoneNumberId) {
        // Look up by phone number ID (stored in vapi_phone_number field, might be a placeholder)
        const { data: firmData, error: lookupError } = await supabase
          .from('firms')
          .select('id, vapi_phone_number, vapi_assistant_id')
          .or(`vapi_phone_number.eq.${actualPhoneNumberId},vapi_phone_number.ilike.%${actualPhoneNumberId}%`)
          .limit(1)
          .maybeSingle();
        
        console.log('[Vapi Webhook] Firm lookup by phoneNumberId:', actualPhoneNumberId, 'Result:', firmData, 'Error:', lookupError);
        
        if (firmData && (firmData as any).id) {
          firmId = (firmData as any).id;
          
          // If we have the actual phone number from webhook and firm only has ID stored, update it
          if (actualPhoneNumber && actualPhoneNumber.match(/^\+?[1-9]\d{1,14}$/) && 
              (firmData as any).vapi_phone_number && 
              !(firmData as any).vapi_phone_number.match(/^\+?[1-9]\d{1,14}$/)) {
            console.log('[Vapi Webhook] Updating firm with actual phone number from webhook:', actualPhoneNumber);
            await supabase
              .from('firms')
              // @ts-ignore
              .update({ vapi_phone_number: actualPhoneNumber })
              .eq('id', firmId);
          }
        }
      }
      
      // Fallback: look up by phone number if we have it
      if (!firmId && actualPhoneNumber) {
        const { data: firmData, error: phoneLookupError } = await supabase
          .from('firms')
          .select('id')
          .eq('vapi_phone_number', actualPhoneNumber)
          .maybeSingle();
        
        console.log('[Vapi Webhook] Firm lookup by phoneNumber:', actualPhoneNumber, 'Result:', firmData, 'Error:', phoneLookupError);
        
        if (firmData && (firmData as any).id) {
          firmId = (firmData as any).id;
        }
      }
    } else if (actualPhoneNumber && actualPhoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      // If we have firmId and actual phone number, check if we need to update the stored number
      const { data: firmData } = await supabase
        .from('firms')
        .select('vapi_phone_number')
        .eq('id', firmId)
        .single();
      
      if (firmData && (firmData as any).vapi_phone_number && 
          !(firmData as any).vapi_phone_number.match(/^\+?[1-9]\d{1,14}$/)) {
        // Firm has ID stored but we have actual number - update it
        console.log('[Vapi Webhook] Updating firm with actual phone number from webhook:', actualPhoneNumber);
        await supabase
          .from('firms')
          // @ts-ignore
          .update({ vapi_phone_number: actualPhoneNumber })
          .eq('id', firmId);
      }
    }

    console.log('[Vapi Webhook] Resolved firmId:', firmId);

    // If we still don't have firmId, try one more lookup by assistant ID
    if (!firmId) {
      const assistantId = metadata?.assistantId || body.assistantId || body.assistant?.id;
      if (assistantId) {
        console.log('[Vapi Webhook] Trying firm lookup by assistantId:', assistantId);
        const { data: firmData } = await supabase
          .from('firms')
          .select('id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();
        
        if (firmData && (firmData as any).id) {
          firmId = (firmData as any).id;
          console.log('[Vapi Webhook] Found firm by assistantId:', firmId);
        }
      }
    }

    if (!firmId) {
      console.error('[Vapi Webhook] CRITICAL: Could not resolve firmId for conversation:', conversation_id);
      console.error('[Vapi Webhook] Phone Number:', actualPhoneNumber);
      console.error('[Vapi Webhook] Phone Number ID:', actualPhoneNumberId);
      console.error('[Vapi Webhook] Metadata:', JSON.stringify(metadata, null, 2));
      console.error('[Vapi Webhook] Full body keys:', Object.keys(body));
      // Still return 200 to prevent Vapi retries, but log the error
      return NextResponse.json({ ok: true, warning: 'Could not resolve firmId' });
    }

    if (event === 'conversation.updated') {
      // Update call with latest intake data
      console.log('[Vapi Webhook] Processing conversation.updated event');
      console.log('[Vapi Webhook] Structured data:', JSON.stringify(structuredData, null, 2));
      try {
        await upsertCall({
          conversationId: conversation_id,
          firmId: firmId,
          intake: structuredData,
        });
        console.log('[Vapi Webhook] Call upserted successfully');
      } catch (upsertError: any) {
        console.error('[Vapi Webhook] Error upserting call:', upsertError);
        console.error('[Vapi Webhook] Upsert error stack:', upsertError?.stack);
      }
    }

    if (event === 'conversation.completed') {
      // Finalize call: save transcript, generate summary, send email
      console.log('[Vapi Webhook] Processing conversation.completed event');
      console.log('[Vapi Webhook] Transcript length:', transcript?.length || body.transcript?.length || 0);
      try {
        await finalizeCall({
          conversationId: conversation_id,
          transcript: transcript || body.transcript,
          phoneNumber: actualPhoneNumber,
          firmId: firmId,
        });
        console.log('[Vapi Webhook] Call finalized successfully');
      } catch (finalizeError: any) {
        console.error('[Vapi Webhook] Error finalizing call:', finalizeError);
        console.error('[Vapi Webhook] Finalize error stack:', finalizeError?.stack);
      }
    }

    // Check if agent said goodbye and end call if needed
    // This handles the case where agent says goodbye but call hasn't ended
    if (event === 'conversation.updated' && transcript) {
      const lastMessage = transcript.split('\n').pop() || '';
      const agentSaidGoodbye = lastMessage.toLowerCase().includes('goodbye') || 
                                lastMessage.toLowerCase().includes('take care') ||
                                lastMessage.toLowerCase().includes('thank you for calling');
      
      if (agentSaidGoodbye) {
        console.log('[Vapi Webhook] Agent said goodbye, ending call');
        // The call should end automatically, but we log it
        // Vapi should handle call ending when agent says goodbye
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Vapi Webhook] Error:', error);
    // Always return 200 to prevent Vapi retries
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

