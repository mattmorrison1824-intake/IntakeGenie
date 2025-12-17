/**
 * Build Vapi agent configuration for a law firm
 */
export function buildVapiAgent(firmName: string, customGreeting?: string | null, aiTone?: string, aiKnowledgeBase?: string | null) {
  const greeting = customGreeting 
    ? customGreeting.replace(/{FIRM_NAME}/g, firmName)
    : `Thank you for calling ${firmName}. I'm an automated assistant for the firm. I can't give legal advice, but I can collect details so the firm can follow up. Are you in a safe place to talk right now?`;

  // Note: Vapi doesn't support systemMessage/systemPrompt field
  // System instructions will need to be configured via Vapi dashboard or model instructions
  // For now, we just use the greeting as firstMessage

  return {
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 180,
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
    // Note: Vapi doesn't support systemMessage/systemPrompt field
    // System instructions will need to be configured via Vapi dashboard or model instructions
  };
}

