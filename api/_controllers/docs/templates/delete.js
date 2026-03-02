import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'
import { logAudit } from '../../../_utils/audit.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId, profile } = await verifyUser(req)
    const userRole = profile.role ? profile.role.toLowerCase() : ''

    const { id, source } = req.body
    if (!id || !source) return res.status(400).json({ error: 'Missing required fields' })

    if (source === 'global') {
        if (!['founder', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Unauthorized' })
        }
        
        const { error } = await supabaseAdmin
            .from('global_templates')
            .update({ is_active: false })
            .eq('id', id)

        if (error) throw error

    } else if (source === 'firm') {
        if (!['partner', 'lawyer', 'founder', 'admin'].includes(userRole)) {
             return res.status(403).json({ error: 'Unauthorized' })
        }

        const { error } = await supabaseAdmin
            .from('firm_templates')
            .update({ is_active: false })
            .eq('id', id)
            .eq('firm_id', firmId) // Firm Isolation

        if (error) throw error
    }

    await logAudit({
        action: 'DELETE_TEMPLATE', // Soft Delete
        tableName: source === 'global' ? 'global_templates' : 'firm_templates',
        recordId: id,
        newData: { is_active: false },
        userId, firmId, ipAddress: req.headers['x-forwarded-for']
    })

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Delete Template Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
