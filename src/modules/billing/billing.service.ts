import { supabase } from '../../lib/supabaseClient';

export interface SubscriptionPlan {
  code: 'basic' | 'pro' | 'enterprise';
  name: string;
  price: number;
  lhdn_limit: number;
  storage_limit: number;
}

export const PLANS: Record<string, SubscriptionPlan> = {
  basic: { code: 'basic', name: 'Basic', price: 199, lhdn_limit: 100, storage_limit: 2 },
  pro: { code: 'pro', name: 'Professional', price: 499, lhdn_limit: 500, storage_limit: 10 },
  enterprise: { code: 'enterprise', name: 'Enterprise', price: 999, lhdn_limit: 999999, storage_limit: 100 }
};

export class BillingService {
  
  /**
   * Create or Update Stripe Customer (Mock)
   */
  async createCustomer(firmId: string, email: string) {
    // Call Stripe API
    const stripeCustomerId = `cus_${Date.now()}`; // Mock
    
    // Update DB
    await supabase
      .from('subscriptions')
      .upsert({
        firm_id: firmId,
        stripe_customer_id: stripeCustomerId,
        status: 'incomplete' // waiting for payment
      }, { onConflict: 'firm_id' });
      
    return stripeCustomerId;
  }

  /**
   * Create Checkout Session for Subscription
   */
  async createSubscriptionCheckout(firmId: string, planCode: string) {
    const plan = PLANS[planCode];
    if (!plan) throw new Error('Invalid plan');

    // Call Stripe API to create session
    const checkoutUrl = `https://checkout.stripe.com/mock/${planCode}?firm=${firmId}`;
    
    return { url: checkoutUrl };
  }

  /**
   * Handle Stripe Webhook (invoice.payment_succeeded)
   */
  async handlePaymentSuccess(stripeCustomerId: string, subscriptionId: string, planCode: string) {
    // Find firm by stripe_customer_id
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('firm_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (!sub) throw new Error('Subscription not found');

    const plan = PLANS[planCode] || PLANS['basic'];
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Activate Subscription
    await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscriptionId,
        plan_code: planCode,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        lhdn_quota_limit: plan.lhdn_limit,
        storage_limit_gb: plan.storage_limit
      })
      .eq('firm_id', sub.firm_id);
  }
}

export const billingService = new BillingService();
