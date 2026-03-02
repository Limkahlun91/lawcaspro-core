import { supabase } from '../../lib/supabaseClient';
import { auditService } from '../audit/audit.service';
import { permissionService } from '../auth/permission.service';

export interface CreateQuotationDTO {
  firm_id: string;
  user_id: string;
  client_id: string;
  case_id?: string;
  title: string;
  description?: string;
  items: QuotationItemDTO[];
  valid_until?: string;
  sst_percentage?: number;
}

export interface QuotationItemDTO {
  description: string;
  quantity: number;
  unit_price: number;
  item_type: 'professional_fee' | 'disbursement' | 'misc';
}

export class QuotationService {

  async createQuotation(dto: CreateQuotationDTO) {
    // 1. Permission Check
    if (!(await permissionService.hasPermission(dto.user_id, 'quotation.create'))) {
      throw new Error('Permission Denied');
    }

    // 2. Calculate Totals
    let subtotal = 0;
    const itemsWithAmount = dto.items.map(item => {
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      return { ...item, amount };
    });

    const sstAmount = (subtotal * (dto.sst_percentage || 0)) / 100;
    const totalAmount = subtotal + sstAmount;

    // 3. Generate Quote No (Simple for now)
    const quoteNo = `QT-${Date.now()}`;

    // 4. Create Record
    const { data: quotation, error } = await supabase
      .from('quotations')
      .insert({
        firm_id: dto.firm_id,
        quote_no: quoteNo,
        title: dto.title,
        description: dto.description,
        client_id: dto.client_id,
        case_id: dto.case_id ? parseInt(dto.case_id) : null, // Ensure BigInt
        status: 'draft',
        subtotal,
        sst_amount: sstAmount,
        sst_percentage: dto.sst_percentage,
        total_amount: totalAmount,
        valid_until: dto.valid_until,
        created_by: dto.user_id
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Insert Items
    const itemInserts = itemsWithAmount.map((item, index) => ({
      quotation_id: quotation.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      item_type: item.item_type,
      item_order: index
    }));

    await supabase.from('quotation_items').insert(itemInserts);

    // 6. Audit
    await auditService.log({
      firm_id: dto.firm_id,
      user_id: dto.user_id,
      action: 'CREATE',
      table_name: 'quotations',
      record_id: quotation.id,
      new_data: quotation,
      module: 'quotation'
    });

    return quotation;
  }

  async convertToInvoice(quotationId: string, userId: string, firmId: string) {
    // 1. Permission
    if (!(await permissionService.hasPermission(userId, 'quotation.convert_invoice'))) {
      throw new Error('Permission Denied');
    }

    // 2. Fetch Quotation
    const { data: quotation } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .single();

    if (!quotation) throw new Error('Quotation not found');
    if (quotation.status === 'converted') throw new Error('Already converted');

    // 3. Create Invoice (Simulated via Payment Voucher / Invoice Module)
    // In a full system, we would create an invoice record in 'invoices' table.
    // For now, we simulate by updating status.
    
    await supabase.from('quotations').update({ status: 'converted' }).eq('id', quotationId);

    // 4. Audit
    await auditService.log({
      firm_id: firmId,
      user_id: userId,
      action: 'UPDATE',
      table_name: 'quotations',
      record_id: quotationId,
      old_data: { status: quotation.status },
      new_data: { status: 'converted' },
      module: 'quotation'
    });

    return { success: true };
  }
}

export const quotationService = new QuotationService();
