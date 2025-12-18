import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { getStripe, STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/clients/stripe';

export const runtime = 'nodejs';

/**
 * Update subscription plan (upgrade or downgrade)
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

    const { plan } = await req.json();

    if (!plan || !['starter', 'professional', 'turbo'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get user's firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id, stripe_subscription_id, stripe_customer_id')
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
    const newPriceId = STRIPE_PRICE_IDS[plan as SubscriptionPlan];

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(
      firm.stripe_subscription_id
    );

    // Ensure subscription has items
    if (!subscription.items.data || subscription.items.data.length === 0) {
      return NextResponse.json(
        { error: 'Subscription has no items' },
        { status: 400 }
      );
    }

    // Update subscription with proration (user pays/gets credit for the difference)
    const updatedSubscription = await stripe.subscriptions.update(
      firm.stripe_subscription_id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'always_invoice', // Immediately invoice for the difference
        metadata: {
          ...subscription.metadata,
          plan: plan,
        },
      }
    );

    // Update database
    await supabase
      .from('firms')
      // @ts-ignore - New fields not in types yet
      .update({
        subscription_plan: plan,
        stripe_price_id: newPriceId,
        subscription_status: updatedSubscription.status,
        subscription_current_period_end: (updatedSubscription as any).current_period_end
          ? new Date((updatedSubscription as any).current_period_end * 1000).toISOString()
          : null,
      })
      .eq('id', firm.id);

    return NextResponse.json({
      success: true,
      subscription: {
        status: updatedSubscription.status,
        plan: plan,
      },
    });
  } catch (error: any) {
    console.error('[Stripe Subscription Update] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update subscription',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

