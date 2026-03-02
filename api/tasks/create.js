
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

  // Do not trust firmId from body
  const { caseId, title, assignedTo, dueDate } = req.body;

  try {
    // 1. Get User
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid Token');

    // 2. Get Firm ID securely
    const { data: firmUser, error: firmError } = await supabaseAdmin
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single();

    if (firmError || !firmUser) throw new Error('User not associated with a firm');
    
    // 3. Verify Case belongs to same Firm (Optional but recommended security check before insert)
    // Although RLS on `case_tasks` might not block insertion if we use Service Role, 
    // we should logically ensure we are attaching task to our own case.
    const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select('firm_id')
        .eq('id', caseId)
        .single();
        
    if (caseError || !caseData) throw new Error('Case not found');
    if (caseData.firm_id !== firmUser.firm_id) throw new Error('Unauthorized Access to Case');

    // 4. Insert Task
    const { data, error } = await supabaseAdmin.from('case_tasks').insert({
      case_id: caseId,
      firm_id: firmUser.firm_id, // Trusted Source
      title,
      assigned_to: assignedTo,
      due_date: dueDate,
      status: 'PENDING',
      source: 'MANUAL'
    }).select();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
