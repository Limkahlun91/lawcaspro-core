import { supabase } from '../../../lib/supabaseClient';

export class AccountingReportService {
  
  /**
   * Get AR Aging Report
   */
  async getArAging(firmId: string, asOfDate: string = new Date().toISOString().split('T')[0]) {
    const { data, error } = await supabase.rpc('get_ar_aging', {
      p_firm_id: firmId,
      p_as_of_date: asOfDate
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get Trial Balance
   */
  async getTrialBalance(firmId: string) {
    const { data, error } = await supabase
      .from('view_trial_balance')
      .select('*')
      .eq('firm_id', firmId);

    if (error) throw error;
    return data;
  }

  /**
   * Get General Ledger for an Account
   */
  async getGeneralLedger(firmId: string, accountCode: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('view_general_ledger')
      .select('*')
      .eq('firm_id', firmId)
      .eq('account_code', accountCode);

    if (startDate) query = query.gte('entry_date', startDate);
    if (endDate) query = query.lte('entry_date', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

export const accountingReportService = new AccountingReportService();
