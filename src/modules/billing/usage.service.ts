import { supabase } from '../../lib/supabaseClient';

export type UsageType = 'lhdn_submission' | 'storage_upload' | 'payment_link';

export class UsageService {
  
  /**
   * Check if a firm has sufficient quota for a specific action.
   * Uses the database stored procedure for efficiency.
   */
  async checkQuota(firmId: string, usageType: UsageType): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_usage_quota', {
      p_firm_id: firmId,
      p_usage_type: usageType
    });

    if (error) {
      console.error('Error checking quota:', error);
      return false; // Fail safe: block if check fails
    }

    return data;
  }

  /**
   * Record usage for a firm.
   */
  async incrementUsage(firmId: string, usageType: UsageType, quantity: number = 1, referenceId?: string) {
    const { error } = await supabase
      .from('usage_logs')
      .insert({
        firm_id: firmId,
        usage_type: usageType,
        quantity: quantity,
        reference_id: referenceId,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log usage:', error);
      // In strict mode, we might throw here. For now, log error but allow operation? 
      // Better to throw if it's critical billing data.
      throw new Error('Failed to record usage');
    }
  }

  /**
   * Get current usage stats for UI
   */
  async getUsageStats(firmId: string) {
    // This would be a more complex query or view in production
    // For now, getting raw counts
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const { count, error } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('usage_type', 'lhdn_submission')
      .gte('created_at', startOfMonth.toISOString());
      
    return {
      lhdn_used: count || 0,
      period_start: startOfMonth.toISOString()
    };
  }
}

export const usageService = new UsageService();
