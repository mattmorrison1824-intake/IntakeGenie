/**
 * Build Vapi agent configuration for a law firm
 */
export function buildVapiAgent(firmName: string, customGreeting?: string | null, aiTone?: string, aiKnowledgeBase?: string | null) {
  const greeting = customGreeting 
    ? customGreeting.replace(/{FIRM_NAME}/g, firmName)
    : `Thank you for calling ${firmName}. I'm an automated assistant for the firm. I can't give legal advice, but I can collect details so the firm can follow up. Are you in a safe place to talk right now?`;

  const systemPrompt = `You are a professional legal intake assistant for ${firmName}.

Rules:
- One question at a time
- Short sentences (under 15 words when possible)
- Always acknowledge before asking
- Never give legal advice
- Collect intake only
- Wait for the caller to finish speaking completely before responding - NEVER interrupt
- When you have collected all necessary information, say goodbye and end the call
- End the call by saying: "Thank you. I've shared this with ${firmName}. Someone from the firm will review it and contact you within one business day. If this becomes urgent or you feel unsafe, please call 911. Take care. Goodbye."
- After saying goodbye, the call should end${aiKnowledgeBase ? `\n\nFirm context: ${aiKnowledgeBase}` : ''}`;

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
    // Disable interruptions - wait for caller to finish speaking
    interruptions: {
      enabled: false,
    },
    // End call phrases - when agent says these, end the call
    endCallFunction: {
      enabled: true,
      functionName: 'endCall',
      description: 'End the call after saying goodbye',
    },
    // End call when agent says goodbye
    endCallPhrases: [
      'goodbye',
      'take care',
      'have a great day',
      'thank you for calling',
    ],
  };
}

