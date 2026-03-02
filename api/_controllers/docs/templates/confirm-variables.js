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
    const { user, firmId, userId } = await verifyUser(req)
    
    const { templateId, source, variables } = req.body // variables: [{id, is_confirmed}]

    if (!templateId || !variables || !Array.isArray(variables)) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    // 1. Bulk Update Variables
    // In a real app, use a single RPC or transaction. Here loop is okay for small sets.
    for (const v of variables) {
        await supabaseAdmin
            .from('template_variables')
            .update({ is_confirmed: v.is_confirmed })
            .eq('id', v.id)
            .eq('template_id', templateId) // Security check
    }

    // 2. Check if ALL variables for this template are confirmed
    const { data: allVars, error: varError } = await supabaseAdmin
        .from('template_variables')
        .select('is_confirmed')
        .eq('template_id', templateId)
    
    if (varError) throw varError

    // If all variables are confirmed, set status to 'ready'
    const allConfirmed = allVars.every(v => v.is_confirmed === true)
    
    // 3. Update Template Status
    const status = allConfirmed ? 'ready' : 'draft'
    const table = source === 'global' ? 'global_templates' : 'firm_templates'
    
    await supabaseAdmin
        .from(table)
        .update({ status })
        .eq('id', templateId)

    await logAudit({
        action: 'CONFIRM_VARIABLES',
        tableName: 'template_variables',
        recordId: templateId,
        newData: { confirmed_count: variables.length, new_status: status },
        userId, firmId, ipAddress: req.headers['x-forwarded-for']
    })

    return res.status(200).json({ success: true, status })

  } catch (error) {
    console.error('Confirm Variables Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
