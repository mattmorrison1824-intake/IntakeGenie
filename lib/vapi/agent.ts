/**
 * Build Vapi agent configuration for a law firm
 */
export function buildVapiAgent(firmName: string, customGreeting?: string | null, aiTone?: string, aiKnowledgeBase?: string | null) {
  const greeting = customGreeting 
    ? customGreeting.replace(/{FIRM_NAME}/g, firmName)
    : `Thank you for calling ${firmName}. I'm an automated assistant for the firm. I can't give legal advice, but I can collect details so the firm can follow up. Are you in a safe place to talk right now?`;

  // Map tone to communication style instructions
  const toneInstructions: Record<string, string> = {
    professional: 'Maintain a calm, clear, and businesslike tone. Be direct and efficient.',
    warm: 'Use a friendly and empathetic tone. Show genuine care and understanding.',
    friendly: 'Be conversational and approachable. Use a relaxed, personable style.',
    formal: 'Use a reserved and respectful tone. Maintain professional distance while being courteous.',
  };

  const toneGuidance = aiTone && toneInstructions[aiTone] 
    ? `\n\nCommunication style: ${toneInstructions[aiTone]}`
    : '';

  const systemPrompt = `You are a professional legal intake assistant for ${firmName}.

Rules:
- One question at a time
- Short sentences (under 15 words when possible)
- Always acknowledge before asking
- Never give legal advice
- Collect intake only
- Wait for the caller to finish speaking completely before responding - NEVER interrupt
- When you have collected all necessary information (name, phone, reason, incident details), say goodbye and end the call
- End the call by saying: "Thank you. I've shared this with ${firmName}. Someone from the firm will review it and contact you within one business day. If this becomes urgent or you feel unsafe, please call 911. Take care. Goodbye."
- After saying goodbye, the call will automatically end${toneGuidance}${aiKnowledgeBase ? `\n\nFirm context: ${aiKnowledgeBase}` : ''}`;

  return {
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 180,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
      ],
    },
    voice: {
      provider: 'deepgram',
      voiceId: 'asteria', // Vapi uses just the voice name, not 'aura-asteria-en'
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
    },
    firstMessage: greeting,
    // Configure stopSpeakingPlan to prevent interruptions
    // High values mean agent waits longer before interrupting
    stopSpeakingPlan: {
      numWords: 5, // Wait for caller to say at least 5 words before considering interruption
      voiceSeconds: 0.5, // Require 0.5 seconds of continuous speech before stopping (max allowed by Vapi)
      backoffSeconds: 2.0, // Wait 2 seconds after interruption before resuming
    },
    // Note: Call ending will be handled via server webhook when agent says goodbye
    // The webhook will detect the goodbye message and end the call
  };
}

