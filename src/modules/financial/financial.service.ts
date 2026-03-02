import { supabase } from '../../lib/supabaseClient';
import { auditService } from '../audit/audit.service';
import { permissionService } from '../auth/permission.service';

export interface CreateFinancialDocDTO {
  firm_id: string;
  user_id: string;
  document_type: 'quotation' | 'invoice' | 'credit_note';
  client_id: string;
  case_id?: string;
  items: FinancialItemDTO[];
  sst_percentage?: number;
  currency?: string;
}

export interface FinancialItemDTO {
  description: string;
  qty: number;
  unit_price: number;
  account_code?: string;
  tax_code?: string;
}

export class FinancialService {

  /**
   * Create a Financial Document (Quote, Invoice, etc.)
   */
  async createDocument(dto: CreateFinancialDocDTO) {
    // 1. Permission Check
    const permission = dto.document_type === 'quotation' ? 'finance.create_quote' : 'finance.create_invoice';
    if (!(await permissionService.hasPermission(dto.user_id, permission))) {
      throw new Error('Permission Denied');
    }

    // 2. Calculations
    let subtotal = 0;
    const itemsWithAmount = dto.items.map(item => {
      const amount = item.qty * item.unit_price;
      subtotal += amount;
      return { ...item, amount };
    });

    const sstAmount = (subtotal * (dto.sst_percentage || 0)) / 100;
    const totalAmount = subtotal + sstAmount;

    // 3. Generate Doc No
    const prefix = dto.document_type === 'quotation' ? 'QT' : dto.document_type === 'invoice' ? 'INV' : 'CN';
    const docNo = `${prefix}-${Date.now()}`;

    // 4. Create Master Record
    const { data: doc, error } = await supabase
      .from('financial_documents')
      .insert({
        firm_id: dto.firm_id,
        document_type: dto.document_type,
        document_no: docNo,
        client_id: dto.client_id,
        case_id: dto.case_id ? parseInt(dto.case_id) : null,
        status: 'draft',
        currency: dto.currency || 'MYR',
        subtotal,
        sst_amount: sstAmount,
        sst_percentage: dto.sst_percentage,
        total_amount: totalAmount,
        balance_due: totalAmount, // Initial balance
        created_by: dto.user_id
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Insert Items
    const itemInserts = itemsWithAmount.map((item, index) => ({
      document_id: doc.id,
      description: item.description,
      qty: item.qty,
      unit_price: item.unit_price,
      amount: item.amount,
      account_code: item.account_code,
      tax_code: item.tax_code,
      item_order: index
    }));

    await supabase.from('financial_document_items').insert(itemInserts);

    // 6. Audit
    await auditService.log({
      firm_id: dto.firm_id,
      user_id: dto.user_id,
      action: 'CREATE',
      table_name: 'financial_documents',
      record_id: doc.id,
      new_data: doc,
      module: 'financial'
    });

    return doc;
  }

  /**
   * Convert Quotation to Invoice
   */
  async convertQuoteToInvoice(quoteId: string, userId: string, firmId: string) {
    // 1. Fetch Quote
    const { data: quote } = await supabase
      .from('financial_documents')
      .select('*, financial_document_items(*)')
      .eq('id', quoteId)
      .eq('document_type', 'quotation')
      .single();

    if (!quote) throw new Error('Quotation not found');

    // 2. Create Invoice using Quote Data
    const invoiceDTO: CreateFinancialDocDTO = {
      firm_id: firmId,
      user_id: userId,
      document_type: 'invoice',
      client_id: quote.client_id,
      case_id: quote.case_id?.toString(),
      sst_percentage: quote.sst_percentage,
      currency: quote.currency,
      items: quote.financial_document_items.map((item: any) => ({
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        account_code: item.account_code,
        tax_code: item.tax_code
      }))
    };

    const invoice = await this.createDocument(invoiceDTO);

    // 3. Link Invoice to Quote
    await supabase
      .from('financial_documents')
      .update({ status: 'converted', source_document_id: invoice.id }) // Should ideally update quote to link forward
      .eq('id', quoteId);
      
    // Better: Update Invoice to link back to Quote
    await supabase
      .from('financial_documents')
      .update({ source_document_id: quoteId })
      .eq('id', invoice.id);

    return invoice;
  }
}

export const financialService = new FinancialService();
