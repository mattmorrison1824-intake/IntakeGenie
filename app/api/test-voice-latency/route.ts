import { NextRequest, NextResponse } from 'next/server';
import { processAgentTurn } from '@/lib/clients/openai';
import { getTTSAudioUrl } from '@/lib/clients/twilio';
import { ConversationState, IntakeData } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint to measure voice agent latency
 * Call: GET /api/test-voice-latency
 * 
 * Measures:
 * - OpenAI response time
 * - TTS generation time (if using premium TTS)
 * - Total latency
 */
export async function GET(request: NextRequest) {
  const results = {
    timings: {} as Record<string, number>,
    errors: [] as string[],
    summary: '',
  };

  try {
    // Sample conversation context
    const context = {
      state: 'CONTACT_NAME' as ConversationState,
      filled: {} as Partial<IntakeData>,
      conversationHistory: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: "Thank you for calling. I'm an automated assistant for the firm. What's your full name?" },
      ],
      firmName: 'Test Law Firm',
      aiTone: 'professional' as const,
      aiKnowledgeBase: null,
    };

    const userUtterance = 'My name is John Doe';

    console.log('[Latency Test] Starting voice agent latency test...');
    console.log('[Latency Test] User utterance:', userUtterance);

    // Test 1: OpenAI Agent Turn Latency
    const openaiStart = Date.now();
    try {
      const agentResponse = await processAgentTurn(context, userUtterance);
      const openaiEnd = Date.now();
      const openaiLatency = openaiEnd - openaiStart;

      results.timings.openai_agent_turn = openaiLatency;
      results.summary = `Agent responded: "${agentResponse.assistant_say.substring(0, 100)}..."`;

      console.log(`[Latency Test] OpenAI response time: ${openaiLatency}ms`);
      console.log(`[Latency Test] Agent response: ${agentResponse.assistant_say.substring(0, 100)}...`);

      // Test 2: TTS Audio Generation Latency
      const ttsStart = Date.now();
      try {
        const { playUrl, fallbackText } = await getTTSAudioUrl(
          agentResponse.assistant_say,
          'test-call-sid',
          'test-turn-1'
        );
        const ttsEnd = Date.now();
        const ttsLatency = ttsEnd - ttsStart;

        results.timings.tts_generation = ttsLatency;
        results.timings.uses_premium_tts = !!playUrl;
        results.timings.total_latency = openaiLatency + ttsLatency;

        console.log(`[Latency Test] TTS generation time: ${ttsLatency}ms`);
        console.log(`[Latency Test] Using premium TTS: ${!!playUrl}`);
        console.log(`[Latency Test] Total latency: ${results.timings.total_latency}ms`);

        // If using premium TTS, also test cache hit scenario
        if (playUrl) {
          const cacheTestStart = Date.now();
          const { playUrl: cachedUrl } = await getTTSAudioUrl(
            agentResponse.assistant_say,
            'test-call-sid',
            'test-turn-1' // Same turn = should be cached
          );
          const cacheTestEnd = Date.now();
          const cacheTestLatency = cacheTestEnd - cacheTestStart;
          
          results.timings.tts_cache_hit = cacheTestLatency;
          console.log(`[Latency Test] TTS cache hit time: ${cacheTestLatency}ms`);
        }
      } catch (ttsError) {
        const errorMsg = ttsError instanceof Error ? ttsError.message : 'Unknown TTS error';
        results.errors.push(`TTS generation failed: ${errorMsg}`);
        console.error('[Latency Test] TTS error:', ttsError);
      }
    } catch (openaiError) {
      const errorMsg = openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error';
      results.errors.push(`OpenAI agent turn failed: ${errorMsg}`);
      console.error('[Latency Test] OpenAI error:', openaiError);
    }

    // Test 3: Multiple consecutive turns (simulating conversation flow)
    const multiTurnResults: number[] = [];
    const testTurns = [
      'John Doe',
      'My phone number is 555-123-4567',
      'I was in a car accident yesterday',
    ];

    for (let i = 0; i < testTurns.length; i++) {
      const turnStart = Date.now();
      try {
        const updatedContext = {
          ...context,
          conversationHistory: [
            ...context.conversationHistory,
            { role: 'user' as const, content: testTurns[i] },
          ],
        };
        await processAgentTurn(updatedContext, testTurns[i]);
        const turnEnd = Date.now();
        multiTurnResults.push(turnEnd - turnStart);
      } catch (error) {
        console.error(`[Latency Test] Multi-turn test ${i} failed:`, error);
      }
    }

    if (multiTurnResults.length > 0) {
      const avgMultiTurn = multiTurnResults.reduce((a, b) => a + b, 0) / multiTurnResults.length;
      const maxMultiTurn = Math.max(...multiTurnResults);
      const minMultiTurn = Math.min(...multiTurnResults);

      results.timings.multi_turn_avg = avgMultiTurn;
      results.timings.multi_turn_max = maxMultiTurn;
      results.timings.multi_turn_min = minMultiTurn;
    }

    // Performance assessment
    const totalLatency = results.timings.total_latency || results.timings.openai_agent_turn || 0;
    let performanceRating = 'Excellent';
    if (totalLatency > 3000) {
      performanceRating = 'Slow';
    } else if (totalLatency > 2000) {
      performanceRating = 'Moderate';
    } else if (totalLatency > 1000) {
      performanceRating = 'Good';
    }

    results.timings.performance_rating = performanceRating;

    return NextResponse.json({
      success: true,
      results,
      recommendations: generateRecommendations(results),
    });
  } catch (error) {
    console.error('[Latency Test] Unexpected error:', error);
    results.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      {
        success: false,
        results,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(results: any): string[] {
  const recommendations: string[] = [];
  const totalLatency = results.timings.total_latency || results.timings.openai_agent_turn || 0;

  if (totalLatency > 3000) {
    recommendations.push('Total latency is high (>3s). Consider optimizing OpenAI model or reducing response length.');
  }

  if (results.timings.openai_agent_turn > 2000) {
    recommendations.push('OpenAI response time is slow (>2s). Consider using a faster model or optimizing prompts.');
  }

  if (results.timings.tts_generation > 1000 && results.timings.uses_premium_tts) {
    recommendations.push('TTS generation is slow (>1s). Consider pre-generating common phrases or using Twilio TTS fallback for faster responses.');
  }

  if (!results.timings.uses_premium_tts) {
    recommendations.push('Premium TTS is not being used. Check DEEPGRAM_API_KEY configuration.');
  }

  if (results.timings.tts_cache_hit && results.timings.tts_cache_hit > 100) {
    recommendations.push('TTS cache hit is slow (>100ms). Consider optimizing cache lookup.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Latency looks good! All components are performing well.');
  }

  return recommendations;
}

