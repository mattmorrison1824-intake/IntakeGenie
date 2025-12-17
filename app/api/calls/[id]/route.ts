import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // Verify user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // Get call with firm info to verify ownership
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('*, firms!inner(owner_user_id)')
      .eq('id', id)
      .single();

    if (callError || !callData) {
      console.error('Call not found or access denied:', callError);
      return NextResponse.json({ error: 'Call not found or access denied' }, { status: 404 });
    }

    const call = callData as any;
    const firm = call.firms as any;

    // Verify user owns the firm
    if (firm.owner_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the call using service client to bypass RLS (we've already verified ownership)
    // This is safe because we've verified the user owns the firm that owns the call
    const { createServiceClient } = await import('@/lib/clients/supabase');
    const serviceSupabase = createServiceClient();
    
    const { error: deleteError, data: deleteData } = await serviceSupabase
      .from('calls')
      .delete()
      .eq('id', id)
      .select();

    if (deleteError) {
      console.error('Error deleting call:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete call',
        details: deleteError.message 
      }, { status: 500 });
    }

    console.log(`Successfully deleted call ${id}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/calls/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

