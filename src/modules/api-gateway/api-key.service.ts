import crypto from 'crypto';
import { supabase } from '../../../lib/supabaseClient';

export class ApiKeyService {
  
  /**
   * Generate a new API Key for a Firm
   */
  async generateKey(firmId: string, userId: string, name: string, scopes: string[]) {
    // 1. Generate Random Key
    const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8); // sk_live_...

    // 2. Store Hash
    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .insert({
        firm_id: firmId,
        name: name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes: scopes,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Return Raw Key (Once only!)
    return { ...keyRecord, rawKey };
  }

  /**
   * Validate API Key from Request Header
   */
  async validateKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { data: key } = await supabase
      .from('api_keys')
      .select('firm_id, scopes, rate_limit_req_per_min')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (!key) return null;

    // Record Usage (Async)
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash);

    return key;
  }
}

export const apiKeyService = new ApiKeyService();
