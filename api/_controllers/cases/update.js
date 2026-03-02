import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const caseId = req.query.id || req.body.id;

    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }

    const {
      case_updates,
      property_updates,
      purchasers,
      spa_status_updates,
      loans
    } = req.body;

    // Initialize Supabase client with user's auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    // Call the Atomic Update RPC
    const { data, error } = await supabase.rpc('update_full_case', {
      p_case_id: caseId,
      p_case_updates: case_updates || null,
      p_property_updates: property_updates || null,
      p_purchasers: purchasers || null,
      p_spa_status_updates: spa_status_updates || null,
      p_loans: loans || null
    });

    if (error) {
      console.error('RPC Error:', error);
      // Check for custom compliance errors
      if (error.message.includes('Compliance Violation')) {
        return res.status(422).json({ error: 'Compliance Violation', details: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ error: 'Unauthorized', details: error.message });
      }
      throw error;
    }

    // Log Audit (Simplified for RPC - detailed field tracking would require fetching old data first)
    // For Enterprise Audit, we might want to move audit logging INTO the database via triggers, 
    // but for now we keep the application-level log.
    await logAudit({
      action: 'UPDATE_FULL_CASE',
      tableName: 'cases',
      recordId: caseId,
      oldData: null, // Optimization: skip fetching old data for now to speed up response
      newData: req.body,
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Update Case Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
