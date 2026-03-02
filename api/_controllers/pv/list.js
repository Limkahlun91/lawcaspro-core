import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logRead } from '../../_utils/audit.js';
import { z } from 'zod';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const ListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  status: z.string().optional()
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const { page, limit, search, status } = ListSchema.parse(req.query);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    let query = supabase
      .from('payment_vouchers')
      .select('*, payment_voucher_cases(case:cases(id, client, fileRef, project))', { count: 'exact' })
      .eq('firm_id', firmId)
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`payee_name.ilike.%${search}%,pv_no.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    await logRead({
        firmId,
        userId,
        resource: 'payment_vouchers',
        count: data ? data.length : 0,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ data, count, page, limit });

  } catch (error) {
    console.error('List PV Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
