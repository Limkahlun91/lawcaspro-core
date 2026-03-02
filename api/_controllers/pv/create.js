import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';
import { encrypt } from '../../_utils/crypto.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Zero Trust: Verify User
    const { user, firmId, userId, profile } = await verifyUser(req);

    // 2. Validate Inputs
    const { 
      payee_name, type, amount, purpose, remarks, 
      payment_status, cases, bank_account, reference 
    } = req.body;

    if (!payee_name || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 3. Enforce Status Workflow
    // Staff/Lawyer can only create 'Draft' or 'Prepared'
    // Partner can create 'Approved'
    let status = 'Draft';
    if (profile.role === 'lawyer') status = 'Prepared';
    if (profile.role === 'partner') status = 'Approved by Partner';
    
    // Override if user explicitly requested a lower status (e.g. Draft)
    if (payment_status === 'Draft') status = 'Draft';

    // 4. Encrypt Sensitive Data
    const bank_account_encrypted = bank_account ? encrypt(bank_account) : null;
    const reference_encrypted = reference ? encrypt(reference) : null;

    // 5. Initialize Supabase with User Token (RLS Context)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.authorization },
      },
    });

    // 6. Call RPC to create PV (Handles sequence number)
    // Note: We use the user's client so RLS applies inside RPC if it queries tables
    const { data, error } = await supabase.rpc('create_payment_voucher', {
      p_payee_name: payee_name,
      p_type: type,
      p_amount: amount,
      p_purpose: purpose || '',
      p_user_id: userId,
      p_remarks: remarks || null,
      p_payment_status: status // Use our enforced status
    });

    if (error) throw error;

    // 7. Update Encrypted Fields (Post-Creation)
    // Since RPC might not accept encrypted columns yet, we update them immediately
    if (bank_account_encrypted || reference_encrypted) {
      await supabase
        .from('payment_vouchers')
        .update({
          bank_account_encrypted,
          reference_encrypted
        })
        .eq('id', data) // data from RPC is usually the ID
        .eq('firm_id', firmId); // Safety check
    }

    // 7.5 Link Cases
    if (cases && Array.isArray(cases) && cases.length > 0) {
      const caseLinks = cases.map(caseId => ({
        pv_id: data,
        case_id: caseId
      }));
      const { error: linkError } = await supabase
        .from('payment_voucher_cases')
        .insert(caseLinks);
      
      if (linkError) console.error('Error linking cases:', linkError);
    }

    // 8. Audit Log
    await logAudit({
      action: 'CREATE_PV',
      tableName: 'payment_vouchers',
      recordId: data,
      newData: { ...req.body, status, id: data },
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(200).json({ success: true, message: 'PV Created', pv_id: data });

  } catch (error) {
    console.error('Create PV Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
