import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { firmId } = await req.json();

    if (!firmId) {
      return NextResponse.json({ error: 'Missing firmId' }, { status: 400 });
    }

    // Get firm data
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    if (firmError || !firmData || (firmData as any).owner_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const firm = firmData as any;

    // Extract phone number ID from stored value
    // Check if it's already a phone number
    if (firm.vapi_phone_number?.match(/^\+?[1-9]\d{1,14}$/)) {
      return NextResponse.json({ phoneNumber: firm.vapi_phone_number });
    }
    
    // Extract ID from various formats
    let phoneNumberId = firm.vapi_phone_number;
    if (firm.vapi_phone_number?.includes('ID: ')) {
      phoneNumberId = firm.vapi_phone_number.split('ID: ')[1]?.split(')')[0] || firm.vapi_phone_number;
    } else if (firm.vapi_phone_number?.includes('Dashboard')) {
      phoneNumberId = firm.vapi_phone_number.split('ID: ')[1]?.split('...')[0] || firm.vapi_phone_number;
    }

    if (!phoneNumberId || phoneNumberId.length < 30) {
      return NextResponse.json({ error: 'No valid phone number ID found' }, { status: 400 });
    }

    // Fetch phone number details from Vapi
    try {
      const getResponse = await vapi.get(`/phone-number/${phoneNumberId}`);
      const data = getResponse.data;
      
      // Check all possible locations for the phone number
      const phoneNumber = 
        data.number ||                                    // Top-level number
        data.phoneNumber ||                               // Alternative top-level
        data.phone ||                                     // Short form
        data.value ||                                     // Generic value
        data.numberValue ||                               // Number value
        data.inboundPhoneNumber ||                        // Inbound number
        data.outboundPhoneNumber ||                       // Outbound number
        data.fallbackDestination?.number ||              // Fallback destination number
        data.fallbackDestination?.callerId ||             // Fallback caller ID
        (data.fallbackDestination && typeof data.fallbackDestination === 'string' ? data.fallbackDestination : null) || // Fallback as string
        null;
      
      console.log('[Refresh Phone] Full response:', JSON.stringify(data, null, 2));
      console.log('[Refresh Phone] Extracted number:', phoneNumber);

      if (phoneNumber) {
        // Update firm with actual phone number
        await supabase
          .from('firms')
          // @ts-ignore
          .update({ vapi_phone_number: phoneNumber })
          .eq('id', firmId);

        return NextResponse.json({ phoneNumber });
      } else {
        // Vapi free phone numbers don't have a number field in the API
        // The number is only visible in the dashboard
        return NextResponse.json({ 
          message: 'Phone number assigned by Vapi but not available via API',
          phoneNumberId: phoneNumberId,
          note: 'Check Vapi dashboard at https://dashboard.vapi.ai to see the actual phone number',
          dashboardUrl: `https://dashboard.vapi.ai/phone-numbers/${phoneNumberId}`
        });
      }
    } catch (vapiError: any) {
      console.error('[Refresh Phone] Error:', vapiError?.response?.data || vapiError?.message);
      return NextResponse.json({ 
        error: 'Failed to fetch phone number',
        details: vapiError?.response?.data || vapiError?.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Refresh Phone] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

