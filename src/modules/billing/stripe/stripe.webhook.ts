import { stripe } from './stripe.client';
import { stripeSubscriptionService } from './stripe.subscription';
import { supabase } from '../../../lib/supabaseClient';

export class StripeWebhookHandler {
  
  /**
   * Process Raw Webhook Request
   */
  async processWebhook(rawBody: string | Buffer, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret!);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    // 1. Idempotency Check
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('status')
      .eq('event_id', event.id)
      .single();

    if (existing && existing.status === 'processed') {
      return { received: true, status: 'already_processed' };
    }

    // 2. Log Event (Pending)
    await supabase.from('stripe_webhook_events').upsert({
      event_id: event.id,
      event_type: event.type,
      status: 'processing',
      payload: event
    });

    try {
      // 3. Handle Business Logic
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
        case 'customer.subscription.created':
          await stripeSubscriptionService.handleSubscriptionUpdate(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          // Extend subscription period or unlock features
          // Usually handled by subscription.updated, but good for invoice-specific logic
          break;
          
        case 'invoice.payment_failed':
          // Trigger email alert or suspension warning
          break;
          
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // 4. Mark Processed
      await supabase
        .from('stripe_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_id', event.id);

    } catch (error: any) {
      // 5. Log Failure
      await supabase
        .from('stripe_webhook_events')
        .update({ status: 'failed', error_message: error.message })
        .eq('event_id', event.id);
        
      throw error; // Retry by Stripe
    }

    return { received: true };
  }
}

export const stripeWebhookHandler = new StripeWebhookHandler();
