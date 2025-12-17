import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Refresh phone number details from Vapi
 * Fetches the latest phone number information and updates the firm record
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const firmId = searchParams.get('firmId');

    if (!firmId) {
      return NextResponse.json({ error: 'Missing firmId' }, { status: 400 });
    }

    // Verify user owns the firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, vapi_phone_number_id, inbound_number_e164')
      .eq('id', firmId)
      .single();

    if (firmError || !firmData || (firmData as any).owner_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const firm = firmData as any;

    if (!firm.vapi_phone_number_id) {
      return NextResponse.json({
        error: 'No Vapi phone number ID found',
        message: 'Phone number must be provisioned first',
      }, { status: 400 });
    }

    console.log('[Telephony Refresh] Fetching phone number from Vapi:', firm.vapi_phone_number_id);

    // Fetch phone number details from Vapi
    try {
      const getResponse = await vapi.get(`/phone-number/${firm.vapi_phone_number_id}`);
      const phoneData = getResponse.data;

      console.log('[Telephony Refresh] Vapi phone number data:', JSON.stringify(phoneData, null, 2));

      // Extract phone number from various possible locations
      const phoneNumber = 
        (phoneData.number && typeof phoneData.number === 'string' && phoneData.number.match(/^\+?[1-9]\d{1,14}$/)) 
          ? phoneData.number 
          : (phoneData.fallbackDestination?.number && typeof phoneData.fallbackDestination.number === 'string' && phoneData.fallbackDestination.number.match(/^\+?[1-9]\d{1,14}$/))
          ? phoneData.fallbackDestination.number
          : null;

      if (!phoneNumber) {
        return NextResponse.json({
          error: 'Phone number not yet assigned',
          message: 'Vapi is still processing the number assignment',
          vapiData: phoneData,
        }, { status: 404 });
      }

      // Update firm record if number changed
      if (phoneNumber !== firm.inbound_number_e164) {
        console.log('[Telephony Refresh] Updating phone number:', phoneNumber);
        const { error: updateError } = await supabase
          .from('firms')
          // @ts-ignore
          .update({ inbound_number_e164: phoneNumber })
          .eq('id', firmId);

        if (updateError) {
          console.error('[Telephony Refresh] Database update error:', updateError);
          return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        phoneNumber,
        vapiPhoneNumberId: firm.vapi_phone_number_id,
        assistantId: phoneData.assistantId,
        message: 'Phone number refreshed successfully',
      });
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message;
      console.error('[Telephony Refresh] Vapi API error:', errorDetails);
      return NextResponse.json({
        error: 'Failed to fetch phone number from Vapi',
        details: errorDetails,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Telephony Refresh] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.response?.data || error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

