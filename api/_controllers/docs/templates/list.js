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

    // 1. Fetch Global Templates (Active Only)
    const { data: globalTemplates, error: globalError } = await supabaseAdmin
        .from('global_templates')
        .select('*')
        .eq('is_active', true)
        .order('name')

    if (globalError) throw globalError

    // 2. Fetch Firm Templates (Active Only)
    const { data: firmTemplates, error: firmError } = await supabaseAdmin
        .from('firm_templates')
        .select('*')
        .eq('firm_id', firmId)
        .eq('is_active', true)
        .order('name')

    if (firmError) throw firmError

    // 3. Combine with Source Tag
    const formattedGlobal = globalTemplates.map(t => ({ ...t, source: 'global' }))
    const formattedFirm = firmTemplates.map(t => ({ ...t, source: 'firm' }))

    return res.status(200).json({
        data: {
            global: formattedGlobal,
            firm: formattedFirm,
            all: [...formattedGlobal, ...formattedFirm]
        }
    })

  } catch (error) {
    console.error('List Templates Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
