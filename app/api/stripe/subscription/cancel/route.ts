import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { getStripe } from '@/lib/clients/stripe';

export const runtime = 'nodejs';

/**
 * Cancel subscription (at period end or immediately)
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

    const { immediately = false } = await req.json();

    // Get user's firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, stripe_subscription_id')
      .eq('owner_user_id', session.user.id)
      .limit(1)
      .single();

    if (firmError || !firmData) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const firm = firmData as any;

    if (!firm.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const stripe = getStripe();

    if (immediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(firm.stripe_subscription_id);
    } else {
      // Cancel at period end (recommended)
      await stripe.subscriptions.update(firm.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    // Get updated subscription to sync with database
    const subscription = await stripe.subscriptions.retrieve(
      firm.stripe_subscription_id
    );

    // Update database
    await supabase
      .from('firms')
      // @ts-ignore - New fields not in types yet
      .update({
        subscription_status: subscription.status,
        subscription_cancel_at_period_end: subscription.cancel_at_period_end || false,
      })
      .eq('id', firm.id);

    return NextResponse.json({
      success: true,
      canceled: immediately ? true : subscription.cancel_at_period_end,
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at period end',
    });
  } catch (error: any) {
    console.error('[Stripe Subscription Cancel] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

