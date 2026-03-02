import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';
import { encrypt } from '../../_utils/crypto.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user, firmId, userId, profile } = await verifyUser(req);
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing ID' });

    // Validate Status Logic (Prevent unauthorized updates on approved PVs)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    const { data: pv, error: fetchError } = await supabase
      .from('payment_vouchers')
      .select('status, firm_id')
      .eq('id', id)
      .single();

    if (fetchError || !pv) return res.status(404).json({ error: 'PV not found' });
    if (pv.firm_id !== firmId) return res.status(403).json({ error: 'Forbidden' });

    // Role Check
    if (['Approved by Lawyer', 'Approved by Partner', 'Submitted to Account', 'Paid'].includes(pv.status)) {
      if (profile.role !== 'partner' && profile.role !== 'founder') {
        return res.status(403).json({ error: 'Cannot edit approved PV' });
      }
    }

    // Encrypt sensitive fields
    if (updates.bank_account) {
      updates.bank_account_encrypted = encrypt(updates.bank_account);
      delete updates.bank_account;
    }
    if (updates.reference) {
      updates.reference_encrypted = encrypt(updates.reference);
      delete updates.reference;
    }

    // Update
    const { data, error } = await supabase
      .from('payment_vouchers')
      .update(updates)
      .eq('id', id)
      .eq('firm_id', firmId)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'UPDATE_PV',
      tableName: 'payment_vouchers',
      recordId: id,
      oldData: pv,
      newData: data,
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ success: true, pv: data });

  } catch (error) {
    console.error('Update PV Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
