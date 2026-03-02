import { supabase } from '../../lib/supabaseClient';
import { auditService } from '../audit/audit.service';
import { permissionService } from '../auth/permission.service';

export interface WorkflowStage {
  name: string;
  permission: string;
  next?: string;
}

// Default Workflow for Finance
const DEFAULT_WORKFLOW: Record<string, WorkflowStage> = {
  'Draft': { name: 'Draft', permission: 'pv.create', next: 'Prepared' },
  'Prepared': { name: 'Prepared', permission: 'pv.prepare', next: 'Approved by Lawyer' },
  'Approved by Lawyer': { name: 'Approved by Lawyer', permission: 'pv.approve_lawyer', next: 'Approved by Partner' },
  'Approved by Partner': { name: 'Approved by Partner', permission: 'pv.approve_partner', next: 'Submitted to Account Dept' },
  'Submitted to Account Dept': { name: 'Submitted to Account Dept', permission: 'pv.submit_account', next: 'Account Paid' },
  'Account Paid': { name: 'Account Paid', permission: 'pv.mark_paid', next: 'Locked' },
  'File Returned': { name: 'File Returned to Incharge', permission: 'pv.return_file', next: 'Draft' }, // Loop back or archive
  'Locked': { name: 'Locked', permission: 'pv.lock' }
};

export class WorkflowService {

  /**
   * Transition Payment Voucher to Next Stage
   */
  async transitionStage(pvId: string, targetStage: string, userId: string, firmId: string, remarks?: string) {
    // 1. Validate Target Stage exists
    const stageConfig = DEFAULT_WORKFLOW[targetStage];
    if (!stageConfig) {
      throw new Error(`Invalid stage: ${targetStage}`);
    }

    // 2. Check Permission for Target Stage
    if (!(await permissionService.hasPermission(userId, stageConfig.permission))) {
      throw new Error(`Permission Denied: You cannot move to ${targetStage}`);
    }

    // 3. Get Current Stage Info
    const { data: currentPV } = await supabase
      .from('payment_vouchers')
      .select('current_stage, current_stage_started_at')
      .eq('id', pvId)
      .single();

    if (!currentPV) throw new Error('Payment Voucher not found');

    const previousStage = currentPV.current_stage || 'Draft';
    const enteredAt = new Date(currentPV.current_stage_started_at || new Date());
    const exitedAt = new Date();
    
    // Calculate Duration (Hours)
    const durationHours = (exitedAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60);

    // 4. Close Previous Stage History (Update existing record if we tracked it by ID, 
    // but simplified design inserts new record for current status. 
    // To be precise: We should find the OPEN history record and close it.
    
    // Find open history record
    const { data: openHistory } = await supabase
      .from('pv_stage_history')
      .select('id')
      .eq('pv_id', pvId)
      .is('exited_at', null)
      .order('entered_at', { ascending: false })
      .limit(1)
      .single();

    if (openHistory) {
      await supabase
        .from('pv_stage_history')
        .update({
          exited_at: exitedAt.toISOString(),
          duration_hours: durationHours
        })
        .eq('id', openHistory.id);
    }

    // 5. Insert New Stage History
    await supabase.from('pv_stage_history').insert({
      firm_id: firmId,
      pv_id: pvId,
      stage_name: targetStage,
      entered_at: exitedAt.toISOString(),
      entered_by: userId,
      remarks: remarks,
      sla_hours: 24 // Default SLA, or fetch from config
    });

    // 6. Update PV Main Table
    const { data: updatedPV, error } = await supabase
      .from('payment_vouchers')
      .update({
        current_stage: targetStage,
        current_stage_started_at: exitedAt.toISOString(),
        // Auto-lock if final stage
        is_locked: targetStage === 'Locked' || targetStage === 'Account Paid' // Maybe lock on Paid?
      })
      .eq('id', pvId)
      .select()
      .single();

    if (error) throw error;

    // 7. Audit Log
    await auditService.log({
      firm_id: firmId,
      user_id: userId,
      action: 'UPDATE', // Or custom action STAGE_CHANGE
      table_name: 'payment_vouchers',
      record_id: pvId,
      old_data: { stage: previousStage },
      new_data: { stage: targetStage },
      module: 'workflow'
    });

    return updatedPV;
  }

  /**
   * Get Stage History for Timeline UI
   */
  async getTimeline(pvId: string) {
    const { data, error } = await supabase
      .from('pv_stage_history')
      .select(`
        *,
        entered_by_user:entered_by (email)
      `)
      .eq('pv_id', pvId)
      .order('entered_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}

export const workflowService = new WorkflowService();
