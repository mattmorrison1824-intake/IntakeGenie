import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/clients/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Assign an existing Vapi phone number to a user account
 * This is a one-time operation to assign the Twilio number imported into Vapi
 */
export async function POST(req: NextRequest) {
  try {
    // Get the phone number and user email from request
    const { phoneNumber, userEmail } = await req.json();

    if (!phoneNumber || !userEmail) {
      return NextResponse.json({ 
        error: 'Missing phoneNumber or userEmail' 
      }, { status: 400 });
    }

    // Validate phone number format (E.164)
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return NextResponse.json({ 
        error: 'Invalid phone number format. Must be E.164 format (e.g., +16592157925)' 
      }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find user by email using auth admin API
    // Note: This requires service role key
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('[Assign Phone] Error fetching users:', usersError);
      return NextResponse.json({ 
        error: 'Failed to fetch users',
        details: usersError.message
      }, { status: 500 });
    }

    const user = usersData.users.find(u => u.email === userEmail);
    
    if (!user) {
      return NextResponse.json({ 
        error: `User with email ${userEmail} not found` 
      }, { status: 404 });
    }

    console.log(`[Assign Phone] Found user: ${user.id} (${user.email})`);

    // Find firm owned by this user
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('owner_user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (firmError) {
      console.error('[Assign Phone] Error fetching firm:', firmError);
      return NextResponse.json({ 
        error: 'Failed to fetch firm',
        details: firmError.message
      }, { status: 500 });
    }

    if (!firmData) {
      return NextResponse.json({ 
        error: `No firm found for user ${userEmail}` 
      }, { status: 404 });
    }

    const firm = firmData as any;
    console.log(`[Assign Phone] Found firm: ${firm.id} (${firm.firm_name})`);

    // Update firm with phone number
    const { error: updateError } = await supabase
      .from('firms')
      // @ts-ignore
      .update({ 
        vapi_phone_number: phoneNumber,
        // Keep existing assistant ID if it exists
      })
      .eq('id', firm.id);

    if (updateError) {
      console.error('[Assign Phone] Error updating firm:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update firm',
        details: updateError.message
      }, { status: 500 });
    }

    console.log(`[Assign Phone] ✅ Successfully assigned phone number ${phoneNumber} to firm ${firm.firm_name}`);

    return NextResponse.json({ 
      success: true,
      message: `Phone number ${phoneNumber} assigned to ${userEmail}`,
      firmId: firm.id,
      firmName: firm.firm_name,
      phoneNumber: phoneNumber
    });
  } catch (error: any) {
    console.error('[Assign Phone] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error?.stack
      },
      { status: 500 }
    );
  }
}

