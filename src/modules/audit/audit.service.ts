import { supabase } from '../../lib/supabaseClient';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'APPROVE' 
  | 'SUBMIT_LHDN' 
  | 'CANCEL' 
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT';

export interface AuditLogPayload {
  firm_id: string;
  user_id: string;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  module?: string;
  metadata?: any;
  ip_address?: string;
}

export class AuditService {
  /**
   * Logs an action to the audit_logs table.
   * This is a critical compliance function. Do not bypass.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          firm_id: payload.firm_id,
          user_id: payload.user_id,
          action: payload.action,
          table_name: payload.table_name,
          record_id: payload.record_id,
          old_data: payload.old_data,
          new_data: payload.new_data,
          module: payload.module || 'system',
          metadata: payload.metadata,
          ip_address: payload.ip_address,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('CRITICAL: Failed to write audit log', error);
        // In a real banking system, we might throw here to prevent the action if audit fails.
        // For now, we log to console.
      }
    } catch (err) {
      console.error('CRITICAL: Audit log exception', err);
    }
  }

  /**
   * Fetch audit logs for a specific record
   */
  async getHistory(firmId: string, tableName: string, recordId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users:user_id (email)
      `) // Assuming users table or profile join
      .eq('firm_id', firmId)
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

export const auditService = new AuditService();
