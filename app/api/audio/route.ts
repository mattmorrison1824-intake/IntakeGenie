import { NextRequest, NextResponse } from 'next/server';
import { generateTTS } from '@/lib/clients/deepgram';

// In-memory cache for generated audio (key: text, value: Buffer)
// In production, consider using Redis or file storage
const audioCache = new Map<string, Buffer>();

// CRITICAL: Must be dynamic and use nodejs runtime for audio serving
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

// Generate a cache key from text
function getCacheKey(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid') || 'test';
    const turn = searchParams.get('turn') || '0';
    const text = searchParams.get('text');

    if (!text) {
      return new NextResponse('Missing text parameter', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    console.log(`[Audio] Request: callSid=${callSid}, turn=${turn}, text="${text.substring(0, 50)}..."`);

    // Check cache first
    const cacheKey = getCacheKey(text);
    let audioBuffer: Buffer;

    if (audioCache.has(cacheKey)) {
      console.log(`[Audio Cache] Hit for: "${text.substring(0, 50)}..."`);
      audioBuffer = audioCache.get(cacheKey)!;
    } else {
      console.log(`[Deepgram TTS] Generating audio for: "${text.substring(0, 50)}..."`);
      
      try {
        // Generate TTS with Deepgram Aura (MP3)
        audioBuffer = await generateTTS(text);
        
        // Always cache the result (increased cache size for better hit rate)
        // LRU eviction: remove oldest entry if cache is full
        if (audioCache.size >= 500) {
          const firstKey = audioCache.keys().next().value;
          if (firstKey !== undefined) {
            audioCache.delete(firstKey);
          }
        }
        audioCache.set(cacheKey, audioBuffer);
      } catch (error) {
        console.error('[Deepgram TTS] Error generating audio:', error);
        // Return 404 so Twilio will skip this Play and continue
        return new NextResponse(null, { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }
    }

    // Return audio as MP3 - Twilio's most reliable format
    // CRITICAL: Return 200 OK directly, no redirects
    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg', // MP3 - Twilio's preferred format
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Audio Route] Error:', error);
    return new NextResponse('Internal server error', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

