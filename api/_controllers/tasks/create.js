import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId } = await verifyUser(req);
    const { case_id, title, description, task_type, due_date, assigned_to, priority } = req.body;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    const newTask = {
      case_id: case_id,
      firm_id: firmId,
      title,
      description,
      task_type: task_type || 'Custom',
      assigned_to: assigned_to || userId, // Default to creator if not specified
      due_date: due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
      status: 'Pending',
      priority: priority || 'Medium',
      auto_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('case_tasks')
      .insert(newTask)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE_TASK',
      tableName: 'case_tasks',
      recordId: data.id,
      newData: newTask,
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(201).json({ success: true, task: data });

  } catch (error) {
    console.error('Create Task Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
