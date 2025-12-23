import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { vapi } from '@/lib/clients/vapi';

export const runtime = 'nodejs';

/**
 * Fix assistant webhook URL for existing firms
 * This ensures all assistants have the correct webhook URL configured
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

    const { firmId } = await req.json();

    if (!firmId) {
      return NextResponse.json({ error: 'Missing firmId' }, { status: 400 });
    }

    // Verify user owns the firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, firm_name, vapi_assistant_id, owner_user_id')
      .eq('id', firmId)
      .single();

    if (firmError || !firmData) {
      console.error('[Fix Assistant] Firm lookup error:', firmError);
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    if ((firmData as any).owner_user_id !== session.user.id) {
      console.error('[Fix Assistant] Ownership mismatch. Firm owner:', (firmData as any).owner_user_id, 'Session user:', session.user.id);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const firm = firmData as any;

    if (!firm.vapi_assistant_id) {
      return NextResponse.json({ 
        error: 'No assistant ID found',
        message: 'Please generate a phone number first to create an assistant'
      }, { status: 400 });
    }

    // Get app URL for webhook
    let appUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      return NextResponse.json({ 
        error: 'App URL not configured' 
      }, { status: 500 });
    }

    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const webhookUrl = `${appUrl}/api/vapi/webhook`;

    console.log('[Fix Assistant] Updating assistant:', firm.vapi_assistant_id);
    console.log('[Fix Assistant] Webhook URL:', webhookUrl);

    // Update assistant with correct webhook URL
    try {
      const updatePayload = {
        server: {
          url: webhookUrl,
        },
        serverMessages: [
          'status-update',
          'end-of-call-report',
          'function-call',
          'transcript',
        ],
        metadata: {
          firmId: firmId,
        },
      };

      await vapi.patch(`/assistant/${firm.vapi_assistant_id}`, updatePayload);
      
      console.log('[Fix Assistant] ✅ Assistant webhook URL updated successfully');

      return NextResponse.json({
        success: true,
        message: 'Assistant webhook URL updated successfully',
        assistantId: firm.vapi_assistant_id,
        webhookUrl,
      });
    } catch (vapiError: any) {
      const errorDetails = vapiError?.response?.data || vapiError?.message;
      console.error('[Fix Assistant] Error updating assistant:', errorDetails);
      return NextResponse.json({
        error: 'Failed to update assistant',
        details: errorDetails,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Fix Assistant] Unexpected error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
    }, { status: 500 });
  }
}

