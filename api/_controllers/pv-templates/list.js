import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logRead } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    const { data, error } = await supabase
      .from('pv_templates')
      .select('id, name')
      .eq('firm_id', firmId)
      .order('name', { ascending: true });

    if (error) throw error;

    await logRead({
        firmId,
        userId,
        resource: 'pv_templates',
        count: data ? data.length : 0,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ data });

  } catch (error) {
    console.error('List Templates Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
