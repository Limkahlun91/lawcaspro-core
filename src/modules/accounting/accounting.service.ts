import { supabase } from '../../lib/supabaseClient';

export class AccountingService {
  
  /**
   * Post Invoice to Ledger (Double Entry)
   * DR Accounts Receivable
   * CR Sales / Tax Payable
   */
  async postInvoice(invoiceId: string, firmId: string) {
    // 1. Fetch Invoice
    const { data: invoice } = await supabase
      .from('financial_documents')
      .select('*, financial_document_items(*)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) throw new Error('Invoice not found');

    // 2. Create Journal Header
    const { data: journal } = await supabase
      .from('journal_entries')
      .insert({
        firm_id: firmId,
        reference_document_id: invoiceId,
        reference_no: invoice.document_no,
        entry_date: new Date().toISOString(),
        description: `Invoice ${invoice.document_no}`,
        status: 'posted'
      })
      .select()
      .single();

    // 3. Create Ledger Lines
    const lines = [];

    // DR Accounts Receivable (Total Amount)
    lines.push({
      journal_id: journal.id,
      account_code: '1200-AR', // Configurable per firm
      description: `Invoice ${invoice.document_no} - ${invoice.client_id}`, // Ideally Client Name
      debit: invoice.total_amount,
      credit: 0
    });

    // CR Sales (Subtotal)
    // In real app, split by item account code
    lines.push({
      journal_id: journal.id,
      account_code: '4000-Sales', 
      description: 'Professional Fees',
      debit: 0,
      credit: invoice.subtotal
    });

    // CR Tax Payable (SST)
    if (invoice.sst_amount > 0) {
      lines.push({
        journal_id: journal.id,
        account_code: '2200-SST-Payable',
        description: 'SST Output Tax',
        debit: 0,
        credit: invoice.sst_amount
      });
    }

    await supabase.from('journal_entry_lines').insert(lines);
  }
}

export const accountingService = new AccountingService();
