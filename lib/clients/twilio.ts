import twilio from 'twilio';
import { NextResponse } from 'next/server';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Lazy-load Twilio client to avoid build-time errors
let _twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  // Skip initialization during build if credentials are invalid
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-production-build') {
      // During build, return a mock client to avoid errors
      return {} as ReturnType<typeof twilio>;
    }
    throw new Error('Missing or invalid Twilio credentials');
}
  if (!_twilioClient) {
    _twilioClient = twilio(accountSid, authToken);
  }
  return _twilioClient;
}

// Export as getter for backward compatibility
export const twilioClient = new Proxy({} as ReturnType<typeof twilio>, {
  get(_target, prop) {
    const client = getTwilioClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const twilioNumber = process.env.TWILIO_NUMBER;

// Normalize app URL to prevent double slashes
export function normalizeAppUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

// TwiML response helpers
export function generateTwiML(xml: string): NextResponse {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}

/**
 * Generate a premium TTS audio URL using Deepgram Aura
 * Falls back to Twilio <Say> if Deepgram is unavailable
 * 
 * @param text - Text to speak (use short sentences)
 * @param callSid - Call SID for audio URL generation
 * @param turn - Turn number for audio URL generation
 * @param usePremium - Whether to use premium TTS (default: true)
 * @returns Object with playUrl (for <Play>) and fallbackText (for <Say>)
 */
export async function getTTSAudioUrl(
  text: string,
  callSid: string,
  turn: string = '0',
  usePremium: boolean = true
): Promise<{ playUrl: string | null; fallbackText: string }> {
  // Format phone numbers in text for TTS
  const { formatTextWithPhoneNumbers } = await import('@/lib/utils/phone-tts');
  const formattedText = formatTextWithPhoneNumbers(text);

  if (!usePremium) {
    return { playUrl: null, fallbackText: formattedText };
  }

  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!appUrl) {
    return { playUrl: null, fallbackText: formattedText };
  }

  // Skip premium TTS if DEEPGRAM_API_KEY is not configured
  if (!process.env.DEEPGRAM_API_KEY) {
    console.warn('[TTS] DEEPGRAM_API_KEY not configured, using Twilio TTS fallback');
    return { playUrl: null, fallbackText: formattedText };
  }

  // Use query params instead of dynamic route to avoid redirects
  // Format: /api/audio?callSid=X&turn=Y&text=Z
  const encodedText = encodeURIComponent(formattedText);
  const playUrl = `${appUrl}/api/audio?callSid=${encodeURIComponent(callSid)}&turn=${encodeURIComponent(turn)}&text=${encodedText}`;

  return { playUrl, fallbackText: formattedText };
}

/**
 * Trigger speculative TTS generation in the background (non-blocking)
 * This pre-generates audio so it's likely cached when Twilio requests it
 */
export function triggerSpeculativeTTS(
  text: string,
  callSid: string,
  turn: string = '0'
): void {
  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!appUrl || !process.env.DEEPGRAM_API_KEY) {
    return; // Skip if not configured
  }

  // Format phone numbers and trigger TTS generation in background
  import('@/lib/utils/phone-tts').then(({ formatTextWithPhoneNumbers }) => {
    const formattedText = formatTextWithPhoneNumbers(text);
    const encodedText = encodeURIComponent(formattedText);
    const audioUrl = `${appUrl}/api/audio?callSid=${encodeURIComponent(callSid)}&turn=${encodeURIComponent(turn)}&text=${encodedText}`;

    // Fire and forget - trigger generation in background
    fetch(audioUrl).catch(() => {
      // Silently fail - this is just speculative
    });
  }).catch(() => {
    // Ignore errors in speculative generation
  });
}

