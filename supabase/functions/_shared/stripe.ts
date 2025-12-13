// Shared Stripe configuration and utilities
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

export const PLATFORM_FEE_PERCENTAGE = 0.10; // 10% platform fee

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE);
}

export function calculateNetAmount(amount: number): number {
  return amount - calculatePlatformFee(amount);
}

export default stripe;
