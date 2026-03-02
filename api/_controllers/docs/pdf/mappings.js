import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'
import { logAudit } from '../../../_utils/audit.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    const { user, firmId, userId, profile } = await verifyUser(req)
    
    // GET: Fetch mappings and dictionary
    if (req.method === 'GET') {
        const { template_id } = req.query;
        if (!template_id) return res.status(400).json({ error: 'Missing template_id' });

        // 1. Fetch Mappings
        const { data: mappings, error: mapError } = await supabaseAdmin
            .from('pdf_field_mappings')
            .select('*')
            .eq('template_id', template_id)
            .order('pdf_field_name', { ascending: true });
        
        if (mapError) throw mapError;

        // 2. Fetch Dictionary
        const { data: dictionary, error: dictError } = await supabaseAdmin
            .from('variable_dictionary')
            .select('*')
            .eq('is_active', true)
            .order('variable_key', { ascending: true });

        if (dictError) throw dictError;

        return res.status(200).json({ mappings, dictionary });
    }

    // PUT: Update mappings and optionally publish
    if (req.method === 'PUT') {
        const { template_id, mappings, status, template_source } = req.body;
        
        if (!template_id || !mappings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Update Mappings
        // We use upsert or update. Since ID exists, we can loop update.
        // For bulk performance, upsert is better if we have all fields.
        // But here we might just be updating specific fields.
        // Let's iterate for now as volume is low (dozens of fields).
        
        const updates = mappings.map(m => ({
            id: m.id,
            variable_key: m.variable_key || null, // Ensure null if empty string
            static_value: m.static_value || null,
            is_required: !!m.is_required,
            transformation_rule: m.transformation_rule || null,
            updated_at: new Date()
        }));

        const { error: updateError } = await supabaseAdmin
            .from('pdf_field_mappings')
            .upsert(updates);
        
        if (updateError) throw updateError;

        // 2. Update Template Status if requested
        let newStatus = null;
        if (status === 'ready') {
            // Validate: Ensure all required fields are mapped? 
            // Or just trust user. Let's trust user for now.
            const table = template_source === 'global' ? 'global_templates' : 'firm_templates';
            
            const { error: statusError } = await supabaseAdmin
                .from(table)
                .update({ status: 'ready' })
                .eq('id', template_id);
            
            if (statusError) throw statusError;
            newStatus = 'ready';
        }

        // 3. Audit Log
        await logAudit({
            action: 'UPDATE_PDF_MAPPING',
            tableName: 'pdf_field_mappings',
            recordId: template_id,
            newData: { count: mappings.length, newStatus },
            userId, firmId, ipAddress: req.headers['x-forwarded-for']
        });

        return res.status(200).json({ success: true, status: newStatus });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('PDF Mapping API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
