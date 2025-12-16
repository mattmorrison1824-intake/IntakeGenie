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

// TwiML response helpers
export function generateTwiML(xml: string): NextResponse {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}

