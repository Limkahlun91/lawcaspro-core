import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { firmId } = await verifyUser(req)
    const { caseId } = req.query
    
    if (!caseId) return res.status(400).json({ error: 'Missing caseId' })

    // Verify Case belongs to Firm
    const { data: caseInfo, error: caseError } = await supabaseAdmin
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('firm_id', firmId)
        .single()

    if (caseError || !caseInfo) return res.status(404).json({ error: 'Case not found' })

    const { data, error } = await supabaseAdmin
        .from('generated_documents')
        .select(`
            *,
            global_template:global_templates(name),
            firm_template:firm_templates(name)
        `)
        .eq('case_id', caseId)
        .order('generated_at', { ascending: false })

    if (error) throw error
    
    // Normalize name
    const formatted = data.map(d => ({
        ...d,
        template_name: d.template_source === 'global' ? d.global_template?.name : d.firm_template?.name
    }))

    return res.status(200).json({ data: formatted })

  } catch (error) {
    console.error('List Generated Docs Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
