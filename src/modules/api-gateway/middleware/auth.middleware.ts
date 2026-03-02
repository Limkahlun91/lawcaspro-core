import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { supabase } from '../../../lib/supabaseClient';

export interface AuthenticatedRequest extends NextApiRequest {
  firmId?: string;
  apiKeyId?: string;
}

export class ApiMiddleware {
  
  /**
   * Middleware to validate API Key (Constant-Time Compare)
   */
  async validateApiKey(req: AuthenticatedRequest, res: NextApiResponse, next: () => void) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing API Key' });
    }

    const rawKey = authHeader.split(' ')[1];
    
    // Hash provided key
    const providedHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Fetch key from DB (Assume we have a way to lookup by prefix or scan)
    // For performance, we usually index key_hash directly.
    // However, to prevent timing attacks on DB lookup, we query by exact hash match.
    // The DB query itself might leak timing info, but SHA256 collision is hard.
    
    const { data: key } = await supabase
      .from('api_keys')
      .select('id, firm_id, key_hash, is_active, rate_limit_req_per_min')
      .eq('key_hash', providedHash)
      .single();

    if (!key || !key.is_active) {
      // Fake verify to prevent timing attack on existence? 
      // In practice, constant time compare is for the hash check itself.
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    // Constant Time Comparison (Redundant here since we queried by hash, but good practice if we fetched by ID)
    const valid = crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(key.key_hash)
    );

    if (!valid) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    // Attach Context
    req.firmId = key.firm_id;
    req.apiKeyId = key.id;

    // TODO: Check Rate Limit (Redis)
    
    // Log Usage (Async)
    this.logUsage(key.id, key.firm_id, req);

    next();
  }

  private async logUsage(keyId: string, firmId: string, req: NextApiRequest) {
    await supabase.from('api_usage_logs').insert({
      api_key_id: keyId,
      firm_id: firmId,
      endpoint: req.url || 'unknown',
      method: req.method || 'GET',
      ip_address: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress
    });
  }
}

export const apiMiddleware = new ApiMiddleware();
