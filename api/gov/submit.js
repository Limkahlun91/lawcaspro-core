
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { caseId, provider, type, payload } = req.body;

  try {
    // 1. Get User
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid Token');

    // 2. Get Firm ID
    const { data: firmUser, error: firmError } = await supabaseAdmin
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single();

    if (firmError || !firmUser) throw new Error('User not associated with a firm');

    // 3. Verify Case Access
    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select('firm_id')
        .eq('id', caseId)
        .single();
        
    if (caseError || !caseData) throw new Error('Case not found');
    if (caseData.firm_id !== firmUser.firm_id) throw new Error('Unauthorized Access to Case');

    // 4. Insert into Queue (Handle Duplicates via DB Constraint)
    // Note: The DB now has a UNIQUE INDEX on (case_id, provider, submission_type) where status is pending/processing.
    const { data, error } = await supabaseAdmin.from('gov_submission_queue').insert({
      case_id: caseId,
      firm_id: firmUser.firm_id,
      provider: provider,
      submission_type: type,
      payload: payload,
      status: 'PENDING'
    }).select();

    if (error) {
        // Check for unique violation
        if (error.code === '23505') { // Postgres Unique Violation
            return res.status(409).json({ error: 'Submission already pending for this case/provider' });
        }
        throw error;
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
