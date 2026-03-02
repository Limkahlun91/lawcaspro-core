import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId } = await verifyUser(req);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    const { data, error } = await supabase
      .from('view_case_revenue_recognition')
      .select('*')
      .eq('firm_id', firmId);

    if (error) throw error;

    return res.status(200).json({ success: true, revenue: data });

  } catch (error) {
    console.error('Revenue Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
