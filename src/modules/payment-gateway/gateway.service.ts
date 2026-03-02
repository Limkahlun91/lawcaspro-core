import { supabase } from '../../lib/supabaseClient';

export class PaymentGatewayService {
  
  /**
   * Create a Payment Link (e.g. Stripe Checkout)
   */
  async createPaymentLink(invoiceId: string, firmId: string, gateway: 'stripe' | 'billplz' = 'stripe') {
    // 1. Fetch Invoice
    const { data: invoice } = await supabase
      .from('financial_documents')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (!invoice) throw new Error('Invoice not found');

    // 2. Call Gateway API (Simulated)
    const mockUrl = `https://checkout.stripe.com/pay/${Date.now()}`;
    const mockRef = `pi_${Date.now()}`;

    // 3. Create Payment Record
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        firm_id: firmId,
        document_id: invoiceId,
        gateway: gateway,
        amount: invoice.total_amount,
        currency: invoice.currency,
        status: 'pending',
        gateway_reference: mockRef
      })
      .select()
      .single();

    // 4. Update Invoice
    await supabase
      .from('financial_documents')
      .update({
        payment_link_url: mockUrl,
        payment_reference: mockRef
      })
      .eq('id', invoiceId);

    return { url: mockUrl, paymentId: payment.id };
  }

  /**
   * Handle Webhook (Callback)
   */
  async handleWebhook(payload: any, gateway: string) {
    // 1. Verify Signature (Crucial for Security)
    // if (!verifySignature(payload)) throw new Error('Invalid Signature');

    // 2. Extract Data
    const status = payload.status === 'succeeded' ? 'paid' : 'failed';
    const refId = payload.id; // e.g. Stripe Payment Intent ID

    // 3. Find Payment Record
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('gateway_reference', refId)
      .single();

    if (!payment) throw new Error('Payment record not found');
    if (payment.status === 'paid') return; // Idempotency check

    // 4. Update Payment Status
    await supabase
      .from('payments')
      .update({
        status: status,
        callback_payload: payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    // 5. If Paid, Update Invoice & Post to Ledger
    if (status === 'paid') {
      await supabase
        .from('financial_documents')
        .update({
          payment_status: 'paid',
          balance_due: 0
        })
        .eq('id', payment.document_id);

      // Trigger Auto-Journal (Bank DR, AR CR)
      // await accountingService.postPayment(payment.id);
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();
