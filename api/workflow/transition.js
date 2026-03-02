
import { createClient } from '@supabase/supabase-js';

// Use Service Role Key for backend operations to bypass RLS when needed
// and ensuring we control the logic securely.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Extract Token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { caseId, newStageId } = req.body;

  try {
    // 2. Verify User & Get Firm ID (Do NOT trust body firmId)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    // 3. Call Secure RPC
    // Note: The RPC itself (handle_stage_change) now performs:
    // - Firm ownership check (User Firm vs Case Firm)
    // - Row locking
    // - Permission validation
    const { data, error } = await supabaseAdmin.rpc('handle_stage_change', {
      p_case_id: caseId,
      p_new_stage_id: newStageId,
      p_user_id: user.id
    });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error('Transition Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
