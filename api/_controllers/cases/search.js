import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { z } from 'zod';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Validation Schema
const SearchSchema = z.object({
  q: z.string().min(1, 'Query is required').max(100, 'Query too long'),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Zero Trust: Verify User & Get Firm Context
    const { firmId } = await verifyUser(req);

    // 2. Validate Inputs (Zod)
    // Note: req.query values are strings, so coerce limit
    const validationResult = SearchSchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        details: validationResult.error.format() 
      });
    }

    const { q, status, limit } = validationResult.data;

    // 3. Initialize Supabase with User Token (for RLS enforcement)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.authorization,
        },
      },
    });

    // 4. Search with Firm Isolation
    let queryBuilder = supabase
      .from('cases')
      .select('id, case_ref, client')
      .eq('firm_id', firmId) // Explicit Zero Trust check
      .or(`case_ref.ilike.%${q}%,client.ilike.%${q}%`)
      .limit(limit);

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data, error } = await queryBuilder;

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    console.error('Case Search Error:', error);
    if (error.message === 'Missing Authorization header' || error.message === 'Invalid or expired token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
