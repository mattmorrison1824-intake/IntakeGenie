import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { createServiceClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';
import { finalizeCall } from '@/lib/intake/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Backfill missing calls from Vapi API
 * Fetches recent calls from Vapi and creates records for any that don't exist in our database
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, vapi_assistant_id, vapi_phone_number_id, inbound_number_e164, vapi_phone_number')
      .eq('owner_user_id', session.user.id)
      .limit(1)
      .single();

    if (firmError || !firmData) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const firm = firmData as any;

    if (!firm.vapi_assistant_id && !firm.vapi_phone_number_id) {
      return NextResponse.json({ 
        error: 'No Vapi assistant or phone number configured',
        message: 'Please provision a phone number first'
      }, { status: 400 });
    }

    console.log('[Backfill Calls] Starting backfill for firm:', firm.id);
    console.log('[Backfill Calls] Assistant ID:', firm.vapi_assistant_id);
    console.log('[Backfill Calls] Phone Number ID:', firm.vapi_phone_number_id);

    // Fetch recent calls from Vapi
    // Vapi API: GET /call?limit=100&assistantId=xxx or phoneNumberId=xxx
    let vapiCalls: any[] = [];
    
    try {
      // Try fetching by assistant ID first
      if (firm.vapi_assistant_id) {
        console.log('[Backfill Calls] Fetching calls by assistant ID...');
        const response = await vapi.get(`/call`, {
          params: {
            limit: 100,
            assistantId: firm.vapi_assistant_id,
          },
        });
        if (response.data && Array.isArray(response.data)) {
          vapiCalls = response.data;
          console.log(`[Backfill Calls] Found ${vapiCalls.length} calls by assistant ID`);
        }
      }

      // Also try fetching by phone number ID if we have it
      if (firm.vapi_phone_number_id && vapiCalls.length === 0) {
        console.log('[Backfill Calls] Fetching calls by phone number ID...');
        const response = await vapi.get(`/call`, {
          params: {
            limit: 100,
            phoneNumberId: firm.vapi_phone_number_id,
          },
        });
        if (response.data && Array.isArray(response.data)) {
          vapiCalls = response.data;
          console.log(`[Backfill Calls] Found ${vapiCalls.length} calls by phone number ID`);
        }
      }

      // If still no calls, try fetching all recent calls and filter
      if (vapiCalls.length === 0) {
        console.log('[Backfill Calls] Fetching all recent calls...');
        const response = await vapi.get(`/call`, {
          params: {
            limit: 100,
          },
        });
        if (response.data && Array.isArray(response.data)) {
          // Filter by assistant ID or phone number ID
          vapiCalls = response.data.filter((call: any) => {
            return (
              (firm.vapi_assistant_id && call.assistantId === firm.vapi_assistant_id) ||
              (firm.vapi_phone_number_id && call.phoneNumberId === firm.vapi_phone_number_id)
            );
          });
          console.log(`[Backfill Calls] Found ${vapiCalls.length} matching calls from all calls`);
        }
      }
    } catch (vapiError: any) {
      console.error('[Backfill Calls] Error fetching calls from Vapi:', vapiError?.response?.data || vapiError?.message);
      return NextResponse.json({
        error: 'Failed to fetch calls from Vapi',
        details: vapiError?.response?.data || vapiError?.message,
      }, { status: 500 });
    }

    if (vapiCalls.length === 0) {
      return NextResponse.json({
        message: 'No calls found in Vapi',
        backfilled: 0,
        skipped: 0,
      });
    }

    // Get existing call conversation IDs from database
    const serviceSupabase = createServiceClient();
    const { data: existingCalls } = await serviceSupabase
      .from('calls')
      .select('vapi_conversation_id')
      .eq('firm_id', firm.id)
      .not('vapi_conversation_id', 'is', null);

    const existingConversationIds = new Set(
      (existingCalls || [])
        .map((call: any) => call.vapi_conversation_id)
        .filter((id: string | null) => id !== null)
    );

    console.log(`[Backfill Calls] Found ${existingConversationIds.size} existing calls in database`);

    // Process each Vapi call
    let backfilled = 0;
    let skipped = 0;
    let errors = 0;

    for (const vapiCall of vapiCalls) {
      const conversationId = vapiCall.id;

      // Skip if already exists
      if (existingConversationIds.has(conversationId)) {
        skipped++;
        continue;
      }

      try {
        // Fetch full call details from Vapi
        const callDetailResponse = await vapi.get(`/call/${conversationId}`);
        const callDetail = callDetailResponse.data;

        // Extract data from Vapi call
        const callerNumber = callDetail.customer?.number || callDetail.from || '';
        const transcript = callDetail.transcript || callDetail.artifact?.transcript || '';
        const structuredData = callDetail.structuredData || callDetail.artifact?.structuredData || {};
        const recordingUrl = callDetail.recording?.url || callDetail.artifact?.recording?.url || callDetail.recordingUrl || null;
        const startedAt = callDetail.createdAt || callDetail.startedAt || new Date().toISOString();
        const endedAt = callDetail.endedAt || null;

        // Get firm's phone number for to_number
        const toNumber = firm.inbound_number_e164 || firm.vapi_phone_number || '';

        // Create call record using finalizeCall (which handles all the processing)
        await finalizeCall({
          conversationId: conversationId,
          transcript: transcript || undefined,
          phoneNumber: callerNumber || undefined,
          firmId: firm.id,
          intake: structuredData,
          recordingUrl: recordingUrl || undefined,
        });

        // Update call with correct timestamps if we have them
        if (startedAt || endedAt) {
          await serviceSupabase
            .from('calls')
            // @ts-ignore
            .update({
              started_at: startedAt,
              ended_at: endedAt,
              to_number: toNumber,
            })
            .eq('vapi_conversation_id', conversationId);
        }

        backfilled++;
        console.log(`[Backfill Calls] Backfilled call ${conversationId}`);
      } catch (error: any) {
        errors++;
        console.error(`[Backfill Calls] Error processing call ${conversationId}:`, error?.message || error);
      }
    }

    return NextResponse.json({
      message: 'Backfill completed',
      total: vapiCalls.length,
      backfilled,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error('[Backfill Calls] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

