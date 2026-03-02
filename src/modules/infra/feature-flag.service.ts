import { supabase } from '../../lib/supabaseClient';

export class FeatureFlagService {
  
  /**
   * Securely check if a feature is enabled for a firm.
   * Uses the secure stored procedure instead of reading the table directly.
   */
  async isEnabled(firmId: string, flagKey: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_feature_flag', {
      p_firm_id: firmId,
      p_flag_key: flagKey
    });

    if (error) {
      console.warn(`Feature Flag check failed for ${flagKey}:`, error);
      return false; // Fail safe
    }

    return data;
  }
}

export const featureFlagService = new FeatureFlagService();
