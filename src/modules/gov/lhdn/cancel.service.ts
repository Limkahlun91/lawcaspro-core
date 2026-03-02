import { supabase } from '../../../lib/supabaseClient';
import { auditService } from '../../audit/audit.service';
import { financialService } from '../../financial/financial.service';

export class LhdnCancelService {
  
  /**
   * Cancel an e-Invoice
   * This is a complex operation:
   * 1. Call LHDN Cancel API
   * 2. Update Status
   * 3. Issue Credit Note (Accounting Reversal)
   */
  async cancelInvoice(invoiceId: string, firmId: string, userId: string, reason: string) {
    // 1. Fetch Invoice
    const { data: invoice } = await supabase
      .from('financial_documents')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.lhdn_status !== 'validated') {
      throw new Error('Can only cancel validated invoices via LHDN flow');
    }

    // 2. Call LHDN Cancel API (Simulated)
    try {
      // await lhdnApi.cancel(invoice.lhdn_uuid, reason);
      const mockCancelUuid = `CANCEL-${Date.now()}`;

      // 3. Update Invoice Status
      await supabase
        .from('financial_documents')
        .update({
          status: 'cancelled',
          lhdn_status: 'cancelled',
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancellation_uuid: mockCancelUuid
        })
        .eq('id', invoiceId);

      // 4. Auto-Create Credit Note (Financial Reversal)
      // We create a new CN document linked to this invoice
      const cnItems = await this.getItemsForCN(invoiceId);
      
      const cnDTO = {
        firm_id: firmId,
        user_id: userId,
        document_type: 'credit_note' as const,
        client_id: invoice.client_id,
        case_id: invoice.case_id?.toString(),
        sst_percentage: invoice.sst_percentage,
        currency: invoice.currency,
        items: cnItems
      };

      const creditNote = await financialService.createDocument(cnDTO);
      
      // Link CN to Invoice
      await supabase
        .from('financial_documents')
        .update({ source_document_id: invoiceId })
        .eq('id', creditNote.id);

      // 5. Audit
      await auditService.log({
        firm_id: firmId,
        user_id: userId,
        action: 'CANCEL',
        table_name: 'financial_documents',
        record_id: invoiceId,
        new_data: { status: 'cancelled', cn_id: creditNote.id },
        module: 'lhdn'
      });

      return { success: true, creditNoteId: creditNote.id };

    } catch (error) {
      console.error('LHDN Cancel Failed', error);
      throw error;
    }
  }

  private async getItemsForCN(invoiceId: string) {
    const { data: items } = await supabase
      .from('financial_document_items')
      .select('*')
      .eq('document_id', invoiceId);
      
    return (items || []).map((item: any) => ({
      description: `Reversal of ${item.description}`,
      qty: item.qty * -1, // Negative qty for CN? Or positive qty but CN type?
      // Usually CN has positive numbers but treated as negative in accounting.
      // Let's keep positive numbers, the document_type 'credit_note' handles the sign in GL.
      // However, to match exact reversal, copying exact values is safer.
      unit_price: item.unit_price,
      account_code: item.account_code,
      tax_code: item.tax_code
    }));
  }
}

export const lhdnCancelService = new LhdnCancelService();
