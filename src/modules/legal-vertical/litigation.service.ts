import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../modules/infra/logging/logger.service';

export class LitigationService {
  
  /**
   * Create Milestones for a new Litigation Case
   */
  async initializeMilestones(caseId: string, firmId: string) {
    // ...
  }

  /**
   * Complete a Milestone and Auto-Generate Invoice (Atomic)
   */
  async completeMilestone(milestoneId: string, userId: string, firmId: string) {
    // Call the atomic stored procedure instead of separate steps
    // This ensures invoice creation and milestone update happen together
    
    // 1. Calculate Amount first (or let SP do it if logic is simple, here we pass it)
    const { data: ms } = await supabase
      .from('litigation_milestones')
      .select('*, cases(spa_price)')
      .eq('id', milestoneId)
      .single();
      
    if (!ms) throw new Error('Milestone not found');
    const baseFee = ms.cases?.spa_price || 0;
    const amount = (baseFee * ms.billing_percentage) / 100;

    // 2. Execute Transaction
    const { data: invoiceId, error } = await supabase.rpc('complete_litigation_milestone', {
      p_milestone_id: milestoneId,
      p_user_id: userId,
      p_firm_id: firmId,
      p_amount: amount
    });

    if (error) {
      logger.error('financial', 'milestone_complete_failed', error, { milestoneId });
      throw error;
    }

    logger.info('financial', 'milestone_completed', { milestoneId, invoiceId });

    return { id: invoiceId };
  }
}

export const litigationService = new LitigationService();
