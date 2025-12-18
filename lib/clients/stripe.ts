import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    
    // Validate that all price IDs are set
    if (!process.env.STRIPE_PRICE_ID_STARTER || !process.env.STRIPE_PRICE_ID_PROFESSIONAL || !process.env.STRIPE_PRICE_ID_TURBO) {
      throw new Error('Stripe Price IDs are not set. Please set STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PROFESSIONAL, and STRIPE_PRICE_ID_TURBO in your environment variables.');
    }
    
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Stripe Price IDs for each plan
// These should be created in your Stripe Dashboard under Products
// Get these from: https://dashboard.stripe.com/products
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER!,
  professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL!,
  turbo: process.env.STRIPE_PRICE_ID_TURBO!,
} as const;

export type SubscriptionPlan = keyof typeof STRIPE_PRICE_IDS;

