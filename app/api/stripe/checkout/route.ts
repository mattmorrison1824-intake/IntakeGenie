import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/clients/supabase';
import { getStripe, STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/clients/stripe';

export const runtime = 'nodejs';

/**
 * Create a Stripe checkout session for subscription
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

    const { plan, trial } = await req.json();

    if (!plan || !['starter', 'professional', 'turbo'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Only starter plan can have free trial
    const isTrial = trial === true && plan === 'starter';

    // Get user's firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('*')
      .eq('owner_user_id', session.user.id)
      .limit(1)
      .single();

    if (firmError || !firmData) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const firm = firmData as any;

    // Get app URL
    let appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: 'App URL not configured' },
        { status: 500 }
      );
    }

    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const priceId = STRIPE_PRICE_IDS[plan as SubscriptionPlan];

    // Create or retrieve Stripe customer
    const stripe = getStripe();
    let customerId = firm.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          firm_id: firm.id,
          user_id: session.user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to firm
      await supabase
        .from('firms')
        // @ts-ignore - New field not in types yet
        .update({ stripe_customer_id: customerId })
        .eq('id', firm.id);
    }

    // Create checkout session
    const checkoutSessionParams: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?subscription=success`,
      cancel_url: `${appUrl}/pricing?subscription=cancelled`,
      metadata: {
        firm_id: firm.id,
        user_id: session.user.id,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          firm_id: firm.id,
          user_id: session.user.id,
          plan: plan,
        },
      },
    };

    // Add 14-day free trial for starter plan only
    if (isTrial) {
      checkoutSessionParams.subscription_data.trial_period_days = 14;
      checkoutSessionParams.payment_method_collection = 'if_required'; // Don't require payment method for trial
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutSessionParams);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

