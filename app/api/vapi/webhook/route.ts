import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';
import { upsertCall, finalizeCall } from '@/lib/intake/processor';
import { vapi } from '@/lib/clients/vapi';

// Ensure this route is public (no authentication required)
// This route MUST be accessible without authentication for Vapi webhooks
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Explicitly mark as public route - no authentication required
export const maxDuration = 60; // Allow up to 60 seconds for processing

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
  // Log that webhook was received (for debugging 401 issues)
  const timestamp = new Date().toISOString();
  console.log(`[Vapi Webhook] ========== WEBHOOK REQUEST RECEIVED at ${timestamp} ==========`);
  console.log('[Vapi Webhook] Method:', req.method);
  console.log('[Vapi Webhook] URL:', req.url);
  console.log('[Vapi Webhook] Headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    const body = await req.json();

    // Vapi sends webhooks in different formats:
    // 1. New format: { message: { type: "status-update", call: {...}, assistant: {...} } }
    // 2. Old format: { event: "conversation.updated", conversation_id: "...", ... }
    
    let event: string | null = null;
    let conversation_id: string | null = null;
    let transcript: string | undefined;
    let structuredData: any;
    let phoneNumber: string | undefined;
    let metadata: any;
    let phoneNumberId: string | undefined;
    let recordingUrl: string | undefined;

    // Check if it's the new message format (Vapi's actual webhook format)
    if (body.message) {
      const message = body.message;
      
      // Map Vapi message types to our event types
      if (message.type === 'status-update') {
        // status-update with status "ended" means conversation.completed
        if (message.status === 'ended') {
          event = 'conversation.completed';
        } else {
          event = 'conversation.updated';
        }
      } else if (message.type === 'end-of-call-report') {
        // end-of-call-report contains final transcript and data
        event = 'conversation.completed';
      } else {
        event = message.type;
      }
      
      conversation_id = message.call?.id || message.conversation_id;
      // IMPORTANT: caller number is in call.customer.number, NOT phoneNumber.number
      // phoneNumber.number is the Vapi number being called, not the caller
      phoneNumber = message.call?.customer?.number || message.customer?.number;
      phoneNumberId = message.phoneNumber?.id || message.call?.phoneNumberId || message.phoneNumberId;
      metadata = message.assistant?.metadata || message.metadata || message.call?.metadata;
      
      // Extract transcript from various locations
      if (message.artifact?.transcript) {
        transcript = message.artifact.transcript;
      } else if (message.transcript) {
        transcript = message.transcript;
      } else if (message.summary?.transcript) {
        transcript = message.summary.transcript;
      } else if (message.report?.transcript) {
        transcript = message.report.transcript;
      }
      
      // Extract structured data from various locations
      if (message.artifact?.structuredData) {
        structuredData = message.artifact.structuredData;
      } else if (message.structuredData) {
        structuredData = message.structuredData;
      } else if (message.summary?.structuredData) {
        structuredData = message.summary.structuredData;
      } else if (message.report?.structuredData) {
        structuredData = message.report.structuredData;
      }
      
      // Extract recording URL from various locations
      // According to Vapi docs: https://docs.vapi.ai/assistants/call-recording
      // Recording is in artifact.recording - can be a string (URL) or object with url property
      // Check message.artifact.recording first (primary location)
      if (message.artifact?.recording) {
        recordingUrl = typeof message.artifact.recording === 'string' 
          ? message.artifact.recording 
          : message.artifact.recording.url || message.artifact.recording.recordingUrl;
      } 
      // Also check call.artifact.recording (webhook might have call object with artifact)
      else if (message.call?.artifact?.recording) {
        recordingUrl = typeof message.call.artifact.recording === 'string'
          ? message.call.artifact.recording
          : message.call.artifact.recording.url || message.call.artifact.recording.recordingUrl;
      }
      // Fallback to other locations
      else if (message.artifact?.recordingUrl) {
        recordingUrl = message.artifact.recordingUrl;
      } else if (message.call?.artifact?.recordingUrl) {
        recordingUrl = message.call.artifact.recordingUrl;
      } else if (message.recordingUrl) {
        recordingUrl = message.recordingUrl;
      } else if (message.recording?.url) {
        recordingUrl = message.recording.url;
      } else if (message.report?.recordingUrl) {
        recordingUrl = message.report.recordingUrl;
      } else if (message.call?.recordingUrl) {
        recordingUrl = message.call.recordingUrl;
      } else if (message.call?.recording?.url) {
        recordingUrl = message.call.recording.url;
      }
      
      if (recordingUrl) {
        console.log('[Vapi Webhook] Extracted recording URL from webhook:', recordingUrl);
      } else {
        console.log('[Vapi Webhook] No recording URL found in webhook message. Available paths:', {
          hasMessageArtifact: !!message.artifact,
          hasCallArtifact: !!message.call?.artifact,
          messageArtifactKeys: message.artifact ? Object.keys(message.artifact) : [],
          callArtifactKeys: message.call?.artifact ? Object.keys(message.call.artifact) : [],
        });
      }
      
      console.log('[Vapi Webhook] ========== WEBHOOK RECEIVED (VAPI FORMAT) ==========');
      console.log('[Vapi Webhook] Message Type:', message.type);
      console.log('[Vapi Webhook] Call Status:', message.status);
      console.log('[Vapi Webhook] Ended Reason:', message.endedReason);
      console.log('[Vapi Webhook] Mapped Event:', event);
    } else {
      // Old format
      event = body.event;
      conversation_id = body.conversation_id;
      transcript = body.transcript;
      structuredData = body.structuredData;
      phoneNumber = body.phoneNumber;
      metadata = body.metadata;
      phoneNumberId = body.phoneNumberId;
      // Extract recording URL from old format
      if (!recordingUrl) {
        recordingUrl = body.recordingUrl || body.recording?.url || body.recording_url;
      }
      
      console.log('[Vapi Webhook] ========== WEBHOOK RECEIVED (OLD FORMAT) ==========');
    }

    // Extract phone number from various possible locations
    // IMPORTANT: We want the CALLER's number, not the Vapi number
    // The caller is in: call.customer.number, customer.number, or phoneNumber (old format)
    // The Vapi number (being called) is in: phoneNumber.number (new format) - we DON'T want this
    const actualPhoneNumber = phoneNumber || body.call?.customer?.number || body.customer?.number || body.phoneNumber;
    const actualPhoneNumberId = phoneNumberId || body.phoneNumber?.id || body.phoneNumberId;

    console.log('[Vapi Webhook] Event:', event);
    console.log('[Vapi Webhook] Conversation ID:', conversation_id);
    console.log('[Vapi Webhook] Phone Number (caller):', actualPhoneNumber);
    console.log('[Vapi Webhook] Phone Number ID (Vapi number):', actualPhoneNumberId);
    console.log('[Vapi Webhook] Metadata:', JSON.stringify(metadata, null, 2));
    console.log('[Vapi Webhook] Full body keys:', Object.keys(body));
    console.log('[Vapi Webhook] ========== FULL WEBHOOK BODY ==========');
    console.log(JSON.stringify(body, null, 2));
    console.log('[Vapi Webhook] =========================================');

    const supabase = createServiceClient();

    // Look up firm by metadata first (most reliable)
    // Extract from nested message.assistant.metadata if in new format
    let firmId = metadata?.firmId || body.metadata?.firmId || body.message?.assistant?.metadata?.firmId;
    
    console.log('[Vapi Webhook] Initial firmId from metadata:', firmId);
    console.log('[Vapi Webhook] Metadata sources checked:', {
      metadata_firmId: metadata?.firmId,
      body_metadata_firmId: body.metadata?.firmId,
      message_assistant_metadata_firmId: body.message?.assistant?.metadata?.firmId,
    });
    
    if (!firmId) {
      // Try to extract from phoneNumber object if it exists
      if (actualPhoneNumberId) {
        // Look up by phone number ID (stored in vapi_phone_number_id field)
        const { data: firmData, error: lookupError } = await supabase
          .from('firms')
          .select('id, inbound_number_e164, vapi_phone_number_id, vapi_assistant_id')
          .eq('vapi_phone_number_id', actualPhoneNumberId)
          .limit(1)
          .maybeSingle();
        
        console.log('[Vapi Webhook] Firm lookup by phoneNumberId:', actualPhoneNumberId, 'Result:', firmData, 'Error:', lookupError);
        
        if (firmData && (firmData as any).id) {
          firmId = (firmData as any).id;
          
          // If we have the actual phone number from webhook and firm doesn't have it stored, update it
          if (actualPhoneNumber && actualPhoneNumber.match(/^\+?[1-9]\d{1,14}$/) && 
              !(firmData as any).inbound_number_e164) {
            console.log('[Vapi Webhook] Updating firm with actual phone number from webhook:', actualPhoneNumber);
            await supabase
              .from('firms')
              // @ts-ignore
              .update({ inbound_number_e164: actualPhoneNumber })
              .eq('id', firmId);
          }
        }
      }
      
      // Fallback: look up by phone number (check both new and old fields)
      if (!firmId && actualPhoneNumber) {
        const { data: firmData, error: phoneLookupError } = await supabase
          .from('firms')
          .select('id')
          .eq('inbound_number_e164', actualPhoneNumber)
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
        .select('inbound_number_e164')
        .eq('id', firmId)
        .single();
      
      if (firmData && !(firmData as any).inbound_number_e164) {
        // Firm doesn't have the number stored - update it
        console.log('[Vapi Webhook] Updating firm with actual phone number from webhook:', actualPhoneNumber);
        await supabase
          .from('firms')
          // @ts-ignore
          .update({ inbound_number_e164: actualPhoneNumber })
          .eq('id', firmId);
      }
    }

    console.log('[Vapi Webhook] Resolved firmId:', firmId);

    // If we still don't have firmId, try one more lookup by assistant ID
    if (!firmId) {
      // Try multiple locations for assistant ID
      const assistantId = 
        metadata?.assistantId || 
        body.assistantId || 
        body.assistant?.id ||
        body.message?.assistant?.id ||
        body.message?.call?.assistantId ||
        body.call?.assistantId;
        
      console.log('[Vapi Webhook] Attempting assistant ID lookup. Extracted assistantId:', assistantId);
      console.log('[Vapi Webhook] Assistant ID locations checked:', {
        metadata_assistantId: metadata?.assistantId,
        body_assistantId: body.assistantId,
        body_assistant_id: body.assistant?.id,
        message_assistant_id: body.message?.assistant?.id,
        message_call_assistantId: body.message?.call?.assistantId,
        call_assistantId: body.call?.assistantId,
      });
      
      if (assistantId) {
        console.log('[Vapi Webhook] Trying firm lookup by assistantId:', assistantId);
        const { data: firmData, error: assistantLookupError } = await supabase
          .from('firms')
          .select('id, vapi_assistant_id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();
        
        console.log('[Vapi Webhook] Assistant lookup result:', firmData, 'Error:', assistantLookupError);
        
        if (firmData && (firmData as any).id) {
          firmId = (firmData as any).id;
          console.log('[Vapi Webhook] ✅ Found firm by assistantId:', firmId);
        } else {
          console.warn('[Vapi Webhook] No firm found with assistantId:', assistantId);
        }
      } else {
        console.warn('[Vapi Webhook] No assistant ID found in webhook payload');
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

    // Handle status-update as conversation.completed if call ended
    if (body.message?.type === 'status-update' && body.message?.status === 'ended') {
      event = 'conversation.completed';
      conversation_id = body.message.call?.id || conversation_id;
    }

    if (!conversation_id) {
      console.error('[Vapi Webhook] No conversation_id found in webhook');
      return NextResponse.json({ ok: true, warning: 'No conversation_id' });
    }

    // Create/update call record for ANY status-update or conversation.updated event (except ended)
    // This ensures calls appear immediately when they start, even before structured data is available
    if (event === 'conversation.updated' || 
        (event === 'status-update' && body.message?.status !== 'ended') ||
        (body.message?.type === 'status-update' && body.message?.status && body.message.status !== 'ended')) {
      // Create or update call with latest intake data
      // Even if structured data is empty, we still create the call record so it appears immediately
      console.log('[Vapi Webhook] Processing call update event');
      console.log('[Vapi Webhook] Event:', event);
      console.log('[Vapi Webhook] Status:', body.message?.status);
      console.log('[Vapi Webhook] FirmId:', firmId);
      console.log('[Vapi Webhook] Conversation ID:', conversation_id);
      console.log('[Vapi Webhook] Structured data:', JSON.stringify(structuredData, null, 2));
      
      if (!firmId) {
        console.error('[Vapi Webhook] ❌ CRITICAL: Cannot create call - firmId is missing');
        console.error('[Vapi Webhook] Phone Number ID:', actualPhoneNumberId);
        console.error('[Vapi Webhook] Assistant ID:', metadata?.assistantId || body.assistantId || body.assistant?.id || body.message?.assistant?.id || body.message?.call?.assistantId || body.call?.assistantId);
        console.error('[Vapi Webhook] Metadata:', JSON.stringify(metadata, null, 2));
        console.error('[Vapi Webhook] Full body structure:', {
          hasMessage: !!body.message,
          messageType: body.message?.type,
          hasCall: !!body.call,
          hasAssistant: !!body.assistant,
          hasPhoneNumber: !!body.phoneNumber,
        });
        // Still return 200 to prevent retries
        return NextResponse.json({ ok: true, warning: 'Cannot create call - firmId missing' });
      }

      // Check usage limits before allowing new calls (only for new call starts)
      // Skip check if this is an update to an existing call
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id')
        .eq('vapi_conversation_id', conversation_id)
        .maybeSingle();

      if (!existingCall) {
        // This is a new call - check usage limits
        const { data: firmData } = await supabase
          .from('firms')
          .select('subscription_plan, subscription_status')
          .eq('id', firmId)
          .single();

        if (firmData) {
          const plan = (firmData as any).subscription_plan as string | null;
          const status = (firmData as any).subscription_status as string | null;

          // Allow calls if on trial or active subscription
          if (status === 'trialing' || status === 'active') {
            // Import usage check dynamically to avoid circular dependencies
            const { canMakeCall } = await import('@/lib/utils/usage');
            const usageCheck = await canMakeCall(firmId, plan as any, 2);

            if (!usageCheck.allowed) {
              console.warn('[Vapi Webhook] Call blocked - usage limit exceeded:', {
                firmId,
                plan,
                used: usageCheck.used,
                limit: usageCheck.limit,
                remaining: usageCheck.remaining,
              });
              // Return 200 to prevent retries, but log the issue
              // The call will be rejected by Vapi or we can send a message to the caller
              return NextResponse.json({
                ok: true,
                warning: 'Usage limit exceeded',
                message: usageCheck.reason,
              });
            }
          } else if (status !== 'trialing' && status !== 'active') {
            // Subscription not active - block call
            console.warn('[Vapi Webhook] Call blocked - subscription not active:', {
              firmId,
              status,
            });
            return NextResponse.json({
              ok: true,
              warning: 'Subscription not active',
              message: 'Your subscription is not active. Please update your payment method or subscribe to continue receiving calls.',
            });
          }
        }
      }
      
      try {
        // Also update recording URL if it's available in the update webhook
        // This handles cases where recording URL comes before finalization
        if (recordingUrl) {
          console.log('[Vapi Webhook] Recording URL found in update webhook, updating call:', recordingUrl);
          const { data: existingCall } = await supabase
            .from('calls')
            .select('id, recording_url')
            .eq('vapi_conversation_id', conversation_id)
            .maybeSingle();
          
          if (existingCall && !(existingCall as any).recording_url) {
            // Update recording URL if call exists but doesn't have one yet
            await supabase
              .from('calls')
              // @ts-ignore
              .update({ recording_url: recordingUrl })
              .eq('id', (existingCall as any).id);
            console.log('[Vapi Webhook] Updated recording URL for existing call');
          }
        }
        
        const result = await upsertCall({
          conversationId: conversation_id,
          firmId: firmId,
          intake: structuredData, // May be undefined/empty for initial call start
          phoneNumber: actualPhoneNumber, // Pass caller's number
        });
        if (result.success) {
          console.log('[Vapi Webhook] ✅ Call upserted successfully');
          console.log('[Vapi Webhook] Call ID:', result.callId);
        } else {
          console.error('[Vapi Webhook] ❌ Failed to upsert call:', result.error);
          console.error('[Vapi Webhook] Error details:', JSON.stringify(result.error, null, 2));
        }
      } catch (upsertError: any) {
        console.error('[Vapi Webhook] ❌ Exception during upsert:', upsertError);
        console.error('[Vapi Webhook] Upsert error stack:', upsertError?.stack);
        console.error('[Vapi Webhook] Upsert error details:', JSON.stringify(upsertError, null, 2));
        console.error('[Vapi Webhook] Upsert error message:', upsertError?.message);
        // Don't return error - let it continue to finalizeCall
      }
    }

    if (event === 'conversation.completed' || 
        (body.message?.type === 'status-update' && body.message?.status === 'ended') ||
        body.message?.type === 'end-of-call-report') {
      // Finalize call: save transcript, generate summary, send email
      console.log('[Vapi Webhook] Processing conversation.completed event');
      
      // Extract transcript from various locations in webhook
      let finalTranscript = transcript;
      if (!finalTranscript && body.message?.artifact?.transcript) {
        finalTranscript = body.message.artifact.transcript;
      }
      if (!finalTranscript && body.transcript) {
        finalTranscript = body.transcript;
      }
      
      // If transcript is still missing, fetch it from Vapi API
      // Vapi may need time to process the transcript after call ends, so we retry with delays
      let finalStructuredData = structuredData;
      let finalCallerNumber = actualPhoneNumber;
      let finalRecordingUrl = recordingUrl;
      
      if (!finalTranscript || !finalStructuredData || !finalCallerNumber) {
        console.log('[Vapi Webhook] Missing data, fetching from Vapi API...');
        console.log('[Vapi Webhook] Missing transcript:', !finalTranscript);
        console.log('[Vapi Webhook] Missing structured data:', !finalStructuredData);
        console.log('[Vapi Webhook] Missing caller number:', !finalCallerNumber);
        
        // Retry fetching with increasing delays (Vapi may need time to process transcript)
        const delays = [2000, 5000, 10000]; // 2s, 5s, 10s
        let fetchedData = false;
        
        for (let i = 0; i < delays.length; i++) {
          try {
            // Wait before fetching (except first attempt)
            if (i > 0) {
              console.log(`[Vapi Webhook] Waiting ${delays[i]}ms before retry ${i + 1}...`);
              await new Promise(resolve => setTimeout(resolve, delays[i] - delays[i - 1]));
            }
            
            // Fetch call data from Vapi API
            // Use conversation_id as call ID
            console.log(`[Vapi Webhook] Fetching call data from API (attempt ${i + 1}/${delays.length})...`);
            const callResponse = await vapi.get(`/call/${conversation_id}`);
            const callData = callResponse.data;
            
            console.log('[Vapi Webhook] Fetched call data from API:', JSON.stringify(callData, null, 2));
            console.log('[Vapi Webhook] Call data keys:', Object.keys(callData));
            
            // Extract transcript from various possible locations
            if (!finalTranscript) {
              // Try different fields where transcript might be
              finalTranscript = 
                callData.transcript || 
                callData.fullTranscript ||
                callData.transcription ||
                callData.artifact?.transcript ||
                null;
              
              if (finalTranscript) {
                console.log('[Vapi Webhook] Found transcript in API response, length:', finalTranscript.length);
                fetchedData = true;
              }
            }
            
            // Extract structured data from various possible locations
            if (!finalStructuredData) {
              finalStructuredData = 
                callData.structuredData || 
                callData.artifact?.structuredData ||
                callData.data ||
                null;
              
              if (finalStructuredData) {
                console.log('[Vapi Webhook] Found structured data in API response');
                fetchedData = true;
              }
            }
            
            // Extract caller number from API response
            if (!finalCallerNumber) {
              finalCallerNumber = 
                callData.customer?.number || 
                callData.fromNumber ||
                callData.from_number ||
                null;
              
              if (finalCallerNumber) {
                console.log('[Vapi Webhook] Found caller number in API response:', finalCallerNumber);
                fetchedData = true;
              }
            }
            
            // Extract recording URL from API response
            // According to Vapi docs, recording is in artifact.recording
            if (!finalRecordingUrl) {
              if (callData.artifact?.recording) {
                finalRecordingUrl = typeof callData.artifact.recording === 'string'
                  ? callData.artifact.recording
                  : callData.artifact.recording.url || callData.artifact.recording.recordingUrl;
              } else {
                finalRecordingUrl = 
                  callData.artifact?.recordingUrl ||
                  callData.recordingUrl ||
                  callData.recording?.url ||
                  callData.recording_url ||
                  callData.call?.recordingUrl ||
                  callData.call?.recording?.url ||
                  null;
              }
              
              if (finalRecordingUrl) {
                console.log('[Vapi Webhook] Found recording URL in API response:', finalRecordingUrl);
                fetchedData = true;
              } else {
                console.log('[Vapi Webhook] No recording URL found in API response. Available fields:', {
                  hasArtifact: !!callData.artifact,
                  hasRecording: !!callData.recording,
                  hasCall: !!callData.call,
                  artifactKeys: callData.artifact ? Object.keys(callData.artifact) : [],
                  callKeys: callData.call ? Object.keys(callData.call) : [],
                  topLevelKeys: Object.keys(callData),
                });
              }
            }
            
            // Also extract messages/transcript from messages array if available
            if (!finalTranscript && callData.messages && Array.isArray(callData.messages)) {
              console.log('[Vapi Webhook] Processing messages array, length:', callData.messages.length);
              const messages = callData.messages
                .filter((msg: any) => {
                  // Include transcript messages, user/assistant messages, or any message with content
                  return msg.type === 'transcript' || 
                         msg.role === 'user' || 
                         msg.role === 'assistant' ||
                         msg.type === 'message' ||
                         (msg.content && msg.content.trim().length > 0);
                })
                .map((msg: any) => {
                  const role = msg.role === 'user' ? 'Caller' : (msg.role === 'assistant' ? 'Assistant' : 'System');
                  const content = msg.transcript || msg.content || msg.text || '';
                  return `${role}: ${content}`;
                });
              
              if (messages.length > 0) {
                finalTranscript = messages.join('\n');
                console.log('[Vapi Webhook] Built transcript from messages array, length:', finalTranscript?.length || 0);
                fetchedData = true;
              }
            }
            
            // If we got what we needed, break out of retry loop
            if (finalTranscript && finalCallerNumber) {
              console.log('[Vapi Webhook] Successfully fetched all required data');
              break;
            }
            
          } catch (apiError: any) {
            console.error(`[Vapi Webhook] Error fetching call data from API (attempt ${i + 1}):`, apiError?.response?.data || apiError?.message);
            console.error('[Vapi Webhook] API error status:', apiError?.response?.status);
            
            // If it's a 404, the call might not exist yet - continue retrying
            if (apiError?.response?.status === 404 && i < delays.length - 1) {
              console.log('[Vapi Webhook] Call not found yet, will retry...');
              continue;
            }
            
            // For other errors, continue with what we have
            break;
          }
        }
        
        if (!fetchedData) {
          console.warn('[Vapi Webhook] Could not fetch transcript/data from API after all retries');
        }
      }
      
      console.log('[Vapi Webhook] Final transcript length:', finalTranscript?.length || 0);
      console.log('[Vapi Webhook] Final structured data:', JSON.stringify(finalStructuredData, null, 2));
      console.log('[Vapi Webhook] Ended reason:', body.message?.endedReason);
      
      // If we have structured data but no transcript, try to build a basic transcript from structured data
      if (!finalTranscript && finalStructuredData) {
        const transcriptParts: string[] = [];
        if (finalStructuredData.full_name) transcriptParts.push(`Caller: ${finalStructuredData.full_name}`);
        if (finalStructuredData.callback_number) transcriptParts.push(`Phone: ${finalStructuredData.callback_number}`);
        if (finalStructuredData.reason_for_call) transcriptParts.push(`Reason: ${finalStructuredData.reason_for_call}`);
        if (finalStructuredData.incident_details) transcriptParts.push(`Details: ${finalStructuredData.incident_details}`);
        if (transcriptParts.length > 0) {
          finalTranscript = transcriptParts.join('\n');
          console.log('[Vapi Webhook] Built basic transcript from structured data');
        }
      }
      
      try {
        console.log('[Vapi Webhook] Finalizing call with recording URL:', finalRecordingUrl ? 'Yes' : 'No');
        if (finalRecordingUrl) {
          console.log('[Vapi Webhook] Recording URL:', finalRecordingUrl);
        }
        await finalizeCall({
          conversationId: conversation_id,
          transcript: finalTranscript,
          phoneNumber: finalCallerNumber || actualPhoneNumber, // Use caller number from API if available
          firmId: firmId,
          intake: finalStructuredData, // Pass structured data if we fetched it
          recordingUrl: finalRecordingUrl, // Pass recording URL if available
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

    return NextResponse.json({ ok: true }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('[Vapi Webhook] Error:', error);
    console.error('[Vapi Webhook] Error stack:', error?.stack);
    // Always return 200 to prevent Vapi retries, even on errors
    return NextResponse.json({ 
      ok: true, 
      error: error?.message || 'Unknown error',
      note: 'Error logged but returning 200 to prevent retries'
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

