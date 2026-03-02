import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const { id } = req.query;

    if (!id) return res.status(400).json({ error: 'Missing ID' });

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    // Soft Delete (Archive)
    const { data, error } = await supabase
      .from('cases')
      .update({ status: 'Archived', deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('firm_id', firmId)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'DELETE',
      tableName: 'cases',
      recordId: id,
      oldData: { status: 'Open' }, // Simplified
      newData: { status: 'Archived' },
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ success: true, message: 'Case deleted (archived)' });

  } catch (error) {
    console.error('Delete Case Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
