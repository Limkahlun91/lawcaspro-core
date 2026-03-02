import Stripe from 'stripe';

const STRIPE_SECRET_KEY = import.meta.env.VITE_STRIPE_SECRET_KEY || 'sk_test_mock';

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});
