import { supabase } from '../../lib/supabaseClient';
import { auditService } from '../audit/audit.service';
import { permissionService } from '../auth/permission.service';

export interface CreateVoucherDTO {
  firm_id: string;
  user_id: string;
  payee_name: string;
  total_amount: number;
  category: string;
  purpose: string;
  case_ids?: string[]; // Optional linking to multiple cases
  case_allocations?: { case_id: string; amount: number }[]; // Explicit allocation
}

export class PaymentService {
  
  /**
   * Create a new Payment Voucher (Draft)
   */
  async createVoucher(dto: CreateVoucherDTO) {
    // 1. Permission Check
    if (!(await permissionService.hasPermission(dto.user_id, 'pv.create'))) {
      throw new Error('Permission Denied: Cannot create payment voucher');
    }

    // 2. Generate Voucher No (Simple Logic for now, should be sequential per firm in real app)
    const voucherNo = `PV-${Date.now()}`;

    // 3. Create Voucher Record
    const { data: voucher, error } = await supabase
      .from('payment_vouchers')
      .insert({
        firm_id: dto.firm_id,
        voucher_no: voucherNo,
        payee_name: dto.payee_name,
        total_amount: dto.total_amount,
        category: dto.category,
        purpose: dto.purpose,
        status: 'draft',
        created_by: dto.user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 4. Link Cases (if any)
    if (dto.case_allocations && dto.case_allocations.length > 0) {
      const links = dto.case_allocations.map(alloc => ({
        pv_id: voucher.id,
        case_id: alloc.case_id,
        allocated_amount: alloc.amount,
        firm_id: dto.firm_id
      }));

      const { error: linkError } = await supabase.from('pv_cases').insert(links);
      if (linkError) console.error('Failed to link cases', linkError);
    }

    // 5. Audit Log
    await auditService.log({
      firm_id: dto.firm_id,
      user_id: dto.user_id,
      action: 'CREATE',
      table_name: 'payment_vouchers',
      record_id: voucher.id,
      new_data: voucher,
      module: 'payment'
    });

    return voucher;
  }

  /**
   * Approve a Voucher
   */
  async approveVoucher(voucherId: string, userId: string, firmId: string) {
    // 1. Permission Check
    if (!(await permissionService.hasPermission(userId, 'pv.approve'))) {
      throw new Error('Permission Denied: Cannot approve payment voucher');
    }

    // 2. Fetch Current State (Optimistic locking check could go here)
    const { data: current } = await supabase.from('payment_vouchers').select('status').eq('id', voucherId).single();
    if (current?.status !== 'draft') {
      throw new Error('Voucher is not in draft status');
    }

    // 3. Update Status
    const { data: updated, error } = await supabase
      .from('payment_vouchers')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', voucherId)
      .select()
      .single();

    if (error) throw error;

    // 4. Audit Log
    await auditService.log({
      firm_id: firmId,
      user_id: userId,
      action: 'APPROVE',
      table_name: 'payment_vouchers',
      record_id: voucherId,
      old_data: current,
      new_data: updated,
      module: 'payment'
    });

    // 5. Trigger WhatsApp Notification (Async)
    // this.notifyClient(updated);

    return updated;
  }

  /**
   * Lock Voucher for LHDN Submission
   */
  async lockForLHDN(voucherId: string, userId: string, firmId: string) {
    // Check permission
    if (!(await permissionService.hasPermission(userId, 'einvoice.submit'))) {
      throw new Error('Permission Denied');
    }

    const { data, error } = await supabase
      .from('payment_vouchers')
      .update({
        is_locked: true,
        lhdn_submission_status: 'submitted'
      })
      .eq('id', voucherId)
      .select()
      .single();

    if (error) throw error;
    
    await auditService.log({
        firm_id: firmId,
        user_id: userId,
        action: 'SUBMIT_LHDN',
        table_name: 'payment_vouchers',
        record_id: voucherId,
        new_data: data,
        module: 'payment'
    });

    return data;
  }
}

export const paymentService = new PaymentService();
