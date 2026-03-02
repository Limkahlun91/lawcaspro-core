import { stripe } from './stripe.client';
import { supabase } from '../../../lib/supabaseClient';
import { PLANS } from '../billing.service';

export class StripeSubscriptionService {
  
  /**
   * Create Checkout Session for New Subscription
   */
  async createCheckoutSession(firmId: string, email: string, planCode: string) {
    const plan = PLANS[planCode];
    if (!plan) throw new Error('Invalid plan code');

    // 1. Get or Create Customer
    let customerId = await this.getOrCreateCustomer(firmId, email);

    // 2. Create Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'myr',
            product_data: { name: `LawCasPro ${plan.name} Plan` },
            unit_amount: plan.price * 100, // cents
            recurring: { interval: 'month' }
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.VITE_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.VITE_APP_URL}/settings/billing?canceled=true`,
      metadata: {
        firmId: firmId,
        planCode: planCode
      }
    });

    return { url: session.url };
  }

  /**
   * Handle Webhook Event: customer.subscription.updated
   */
  async handleSubscriptionUpdate(subscription: any) {
    const customerId = subscription.customer as string;
    const status = subscription.status;
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString();

    // Find firm
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('firm_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!sub) return; // Unknown customer

    // Update DB
    await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: status, // active, past_due, canceled
        current_period_start: periodStart,
        current_period_end: periodEnd
      })
      .eq('firm_id', sub.firm_id);
      
    // Handle Auto-Suspend if canceled/past_due
    if (status === 'canceled' || status === 'unpaid') {
       // Logic to trigger grace period or soft lock
       // For now, just mark status. Application logic checks status.
    }
  }

  private async getOrCreateCustomer(firmId: string, email: string): Promise<string> {
    // Check DB
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('firm_id', firmId)
      .single();

    if (sub?.stripe_customer_id) return sub.stripe_customer_id;

    // Create in Stripe
    const customer = await stripe.customers.create({
      email: email,
      metadata: { firmId: firmId }
    });

    // Save to DB
    await supabase
      .from('subscriptions')
      .upsert({
        firm_id: firmId,
        stripe_customer_id: customer.id,
        status: 'incomplete'
      }, { onConflict: 'firm_id' });

    return customer.id;
  }
}

export const stripeSubscriptionService = new StripeSubscriptionService();
