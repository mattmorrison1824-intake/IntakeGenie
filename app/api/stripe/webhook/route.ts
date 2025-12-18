import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/clients/supabase';
import { getStripe } from '@/lib/clients/stripe';
import Stripe from 'stripe';

export const runtime = 'nodejs';

/**
 * Handle Stripe webhook events
 * This endpoint should be added to Stripe Dashboard webhooks
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firmId = session.metadata?.firm_id;
        const plan = session.metadata?.plan;

        if (firmId && plan) {
          await supabase
            .from('firms')
            // @ts-ignore - New fields not in types yet
            .update({
              subscription_plan: plan,
              subscription_status: 'active',
            })
            .eq('id', firmId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const firmId = subscription.metadata?.firm_id;
        const plan = subscription.metadata?.plan;

        if (firmId) {
          const updateData: any = {
            // @ts-ignore - New fields not in types yet
            stripe_subscription_id: subscription.id,
            // @ts-ignore
            stripe_price_id: subscription.items.data[0]?.price.id,
            // @ts-ignore
            subscription_status: subscription.status,
            // @ts-ignore
            subscription_current_period_end: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000).toISOString()
              : null,
            // @ts-ignore
            subscription_cancel_at_period_end: (subscription as any).cancel_at_period_end || false,
          };

          if (plan) {
            updateData.subscription_plan = plan;
          }

          // @ts-ignore - New fields not in types yet
          await supabase.from('firms').update(updateData).eq('id', firmId);
        } else if (customerId) {
          // Try to find firm by customer ID
          const { data: firm } = await supabase
            .from('firms')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (firm) {
            const updateData: any = {
              // @ts-ignore - New fields not in types yet
              stripe_subscription_id: subscription.id,
              // @ts-ignore
              stripe_price_id: subscription.items.data[0]?.price.id,
              // @ts-ignore
              subscription_status: subscription.status,
              // @ts-ignore
              subscription_current_period_end: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000).toISOString()
                : null,
              // @ts-ignore
              subscription_cancel_at_period_end: (subscription as any).cancel_at_period_end || false,
            };

            if (plan) {
              updateData.subscription_plan = plan;
            }

            // @ts-ignore - New fields not in types yet
            await supabase.from('firms').update(updateData).eq('id', firm.id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const firmId = subscription.metadata?.firm_id;
        const customerId = subscription.customer as string;

        if (firmId) {
          await supabase
            .from('firms')
            // @ts-ignore - New fields not in types yet
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
            })
            .eq('id', firmId);
        } else if (customerId) {
          // Fallback: try to find firm by customer ID
          const { data: firm } = await supabase
            .from('firms')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (firm) {
            await supabase
              .from('firms')
              // @ts-ignore - New fields not in types yet
              .update({
                subscription_status: 'canceled',
                stripe_subscription_id: null,
              })
              .eq('id', firm.id);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const firmId = subscription.metadata?.firm_id;

          if (firmId) {
            await supabase
              .from('firms')
              // @ts-ignore - New fields not in types yet
              .update({
                subscription_status: 'active',
                subscription_current_period_end: (subscription as any).current_period_end
                  ? new Date((subscription as any).current_period_end * 1000).toISOString()
                  : null,
              })
              .eq('id', firmId);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const firmId = subscription.metadata?.firm_id;

          if (firmId) {
            await supabase
              .from('firms')
              // @ts-ignore - New fields not in types yet
              .update({
                subscription_status: 'past_due',
              })
              .eq('id', firmId);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

