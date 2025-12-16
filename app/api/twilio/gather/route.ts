import { NextRequest, NextResponse } from 'next/server';
import { generateTwiML, normalizeAppUrl, getTTSAudioUrl, triggerSpeculativeTTS } from '@/lib/clients/twilio';
import { createServiceClient } from '@/lib/clients/supabase';
import { processAgentTurn } from '@/lib/clients/openai';
import { ConversationState, IntakeData } from '@/types';
import { twiml } from 'twilio';

// Ensure this route is public (no authentication required)
export const dynamic = 'force-dynamic';

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

// In-memory conversation state (for MVP)
// In production, use Redis or database
const conversationState = new Map<
  string,
  {
    state: ConversationState;
    filled: Partial<IntakeData>;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }
>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const firmId = formData.get('firmId') as string;

    if (!callSid) {
      return generateTwiML(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Error processing call.</Say><Hangup/></Response>'
      );
    }

    const supabase = createServiceClient();

    // Fetch firm name for closing script
    let firmName: string | null = null;
    if (firmId) {
      try {
        const { data: firmData } = await supabase
          .from('firms')
          .select('firm_name')
          .eq('id', firmId)
          .single();
        firmName = (firmData as any)?.firm_name || null;
      } catch (error) {
        console.error('[Gather] Error fetching firm name:', error);
      }
    }

    // Get or initialize conversation state
    let state = conversationState.get(callSid);
    if (!state) {
      state = {
        state: 'START',
        filled: {},
        history: [],
      };
      conversationState.set(callSid, state);
    }

    // Process user utterance
    const userUtterance = speechResult || '';
    if (userUtterance) {
      state.history.push({ role: 'user', content: userUtterance });
    }

    // Call OpenAI to get next response
    const agentResponse = await processAgentTurn(
      {
        state: state.state,
        filled: state.filled,
        conversationHistory: state.history,
        firmName: firmName,
      },
      userUtterance || 'Hello'
    );

    // Update state
    state.state = agentResponse.next_state;
    state.filled = { ...state.filled, ...agentResponse.updates };
    // Use the response text (which may be overridden for CLOSE state)
    const actualResponseText = (agentResponse.next_state === 'CLOSE' || agentResponse.done) 
      ? (firmName ? `Thank you. I've shared this information with the firm. Someone from ${firmName} will review it and contact you within one business day. If this becomes urgent or you feel unsafe, please call 911. Take care.` : agentResponse.assistant_say)
      : agentResponse.assistant_say;
    state.history.push({ role: 'assistant', content: actualResponseText });

    // Persist intake_json to database
    if (Object.keys(agentResponse.updates).length > 0) {
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({
          intake_json: state.filled as IntakeData,
          urgency: agentResponse.updates.emergency_redirected
            ? 'emergency_redirected'
            : agentResponse.updates.urgency_level === 'high'
              ? 'high'
              : 'normal',
        })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);
    }

    // Override closing script with exact required text
    let responseText = agentResponse.assistant_say;
    if (agentResponse.next_state === 'CLOSE' || agentResponse.done) {
      const firmNameText = firmName || 'the firm';
      responseText = `Thank you. I've shared this information with the firm. Someone from ${firmNameText} will review it and contact you within one business day. If this becomes urgent or you feel unsafe, please call 911. Take care.`;
    }

    // PRE-GENERATE TTS immediately to reduce latency
    // This ensures audio is cached before Twilio requests it
    const turnNumber = state.history.length.toString();
    const { formatTextWithPhoneNumbers } = await import('@/lib/utils/phone-tts');
    const formattedText = formatTextWithPhoneNumbers(responseText);
    
    // Generate TTS immediately in parallel (fire and forget)
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (appUrl && process.env.DEEPGRAM_API_KEY) {
      const encodedText = encodeURIComponent(formattedText);
      const audioUrl = `${appUrl}/api/audio?callSid=${encodeURIComponent(callSid)}&turn=${encodeURIComponent(turnNumber)}&text=${encodedText}`;
      // Trigger TTS generation immediately - don't await, just fire it
      fetch(audioUrl).catch(() => {
        // Ignore errors - this is just pre-generation
      });
    }

    // Trigger speculative TTS for likely next response (if continuing)
    if (!agentResponse.done) {
      triggerSpeculativeTTS("Thanks. Let me ask you something.", callSid, `${state.history.length + 1}`);
    }

    const response = new twiml.VoiceResponse();

    // Use the audio URL - it should be cached by now or will be soon
    try {
      const { playUrl, fallbackText } = await getTTSAudioUrl(responseText, callSid, turnNumber);
      console.log('[Gather] Play URL:', playUrl);
      if (playUrl) {
        response.play(playUrl);
      } else {
        // Fallback to Twilio TTS (instant, no latency)
        response.say({ voice: 'alice' }, fallbackText);
      }
    } catch (error) {
      console.error('[Gather] TTS error, using fallback:', error);
      // Use Twilio TTS as fallback (instant)
      response.say({ voice: 'alice' }, responseText);
    }

    // If done, record the call end and hang up
    if (agentResponse.done) {
      // Clean up conversation state
      conversationState.delete(callSid);

      // Update status to transcribing and trigger processing
      // This ensures processing starts even if status callback is delayed
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ status: 'transcribing' })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);

      // Trigger async processing (fire and forget)
      const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
      fetch(`${appUrl}/api/process-call?callSid=${callSid}`, {
        method: 'POST',
      }).catch((err) => console.error('[Gather] Error triggering process-call:', err));

      response.hangup();
    } else {
      // Continue gathering
      response.gather({
        input: ['speech'] as any,
        action: `/api/twilio/gather?callSid=${callSid}&firmId=${firmId}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
      });
    }

    return generateTwiML(response.toString());
  } catch (error) {
    console.error('Error in gather handler:', error);
    return generateTwiML(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">I apologize, but I encountered an error. Please call back later.</Say><Hangup/></Response>'
    );
  }
}

