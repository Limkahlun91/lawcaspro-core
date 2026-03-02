import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const { id } = req.query; // Task ID
    const { status, assigned_to, description } = req.body;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    const updates = {};
    if (status) {
        updates.status = status;
        if (status === 'Completed') {
            updates.completed_at = new Date().toISOString();
            updates.completed_by = userId;
        }
    }
    if (assigned_to) updates.assigned_to = assigned_to;
    if (description) updates.description = description;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('case_tasks')
      .update(updates)
      .eq('id', id)
      .eq('firm_id', firmId) // Ensure task belongs to user's firm
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'UPDATE_TASK',
      tableName: 'case_tasks',
      recordId: id,
      newData: updates,
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ success: true, task: data });

  } catch (error) {
    console.error('Update Task Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
