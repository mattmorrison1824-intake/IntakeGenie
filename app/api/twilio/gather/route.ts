import { NextRequest, NextResponse } from 'next/server';
import { generateTwiML, normalizeAppUrl } from '@/lib/clients/twilio';
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
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call.</Say><Hangup/></Response>'
      );
    }

    const supabase = createServiceClient();

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
      },
      userUtterance || 'Hello'
    );

    // Update state
    state.state = agentResponse.next_state;
    state.filled = { ...state.filled, ...agentResponse.updates };
    state.history.push({ role: 'assistant', content: agentResponse.assistant_say });

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

    const response = new twiml.VoiceResponse();

    // Say the assistant's response
    response.say({ voice: 'alice' }, agentResponse.assistant_say);

    // If done, record the call end and hang up
    if (agentResponse.done) {
      // Clean up conversation state
      conversationState.delete(callSid);

      // Update call status
      await supabase
        .from('calls')
        // @ts-ignore - Supabase type inference issue
        .update({ status: 'transcribing' })
        // @ts-ignore - Supabase type inference issue
        .eq('twilio_call_sid', callSid);

      // Trigger async processing
      const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
      fetch(`${appUrl}/api/process-call?callSid=${callSid}`, {
        method: 'POST',
      }).catch((err) => console.error('Error triggering process-call:', err));

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
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but I encountered an error. Please call back later.</Say><Hangup/></Response>'
    );
  }
}

