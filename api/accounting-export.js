import { createClient } from '@supabase/supabase-js';
import { verifyUser } from './_utils/auth.js';
import { logExport } from './_utils/audit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Zero Trust: Verify User
    const { user, firmId, userId, profile } = await verifyUser(req);

    // 2. Permission Check
    if (profile.role !== 'partner' && profile.role !== 'founder') {
      // Log unauthorized attempt
      await logExport({
        firmId, userId, exportType: 'accounting_export_attempt', recordCount: 0, 
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      });
      return res.status(403).json({ error: 'Forbidden: Only Partners can export accounting data' });
    }

    // 3. Initialize Supabase with Token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.authorization } },
    });

    // 4. Fetch Data (RLS applies)
    // We add .eq('firm_id', firmId) as double safety
    const { data: glData, error: glError } = await supabase
      .from('gl_entries')
      .select(`
          id, date, description, reference_type, reference_id,
          gl_lines ( account_code, debit, credit, description )
      `)
      .eq('firm_id', firmId) 
      .order('date', { ascending: false });

    if (glError) throw glError;

    // 5. Log Export & Check Anomaly
    const recordCount = glData ? glData.length : 0;
    await logExport({
      firmId,
      userId,
      exportType: 'accounting_export',
      recordCount,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    // 6. Generate CSV
    const csvRows = [];
    csvRows.push(['Date', 'Entry ID', 'Description', 'Ref Type', 'Account Code', 'Line Desc', 'Debit', 'Credit']);

    if (glData) {
      glData.forEach(entry => {
        if (entry.gl_lines) {
          entry.gl_lines.forEach(line => {
            csvRows.push([
              entry.date, entry.id, entry.description, entry.reference_type,
              line.account_code, line.description, line.debit, line.credit
            ]);
          });
        }
      });
    }

    const csvString = csvRows.map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=general_ledger_export.csv');
    return res.status(200).send(csvString);

  } catch (error) {
    console.error('Export Error:', error);
    return res.status(500).json({ error: 'Export Failed', details: error.message });
  }
}
