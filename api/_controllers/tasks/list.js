import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const { case_id, status, assigned_to_me } = req.query;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    let query = supabase
      .from('case_tasks')
      .select(`
        *,
        assigned_to_user:assigned_to (email),
        completed_by_user:completed_by (email)
      `)
      .eq('firm_id', firmId)
      .order('due_date', { ascending: true });

    if (case_id) {
      query = query.eq('case_id', case_id);
    }

    if (status) {
      query = query.eq('status', status);
    }
    
    if (assigned_to_me === 'true') {
      query = query.eq('assigned_to', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true, tasks: data });

  } catch (error) {
    console.error('List Tasks Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
