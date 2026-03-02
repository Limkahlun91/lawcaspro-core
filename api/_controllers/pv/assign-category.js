import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../_utils/auth.js'
import { logAudit } from '../../_utils/audit.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId, profile } = await verifyUser(req)
    
    const role = profile.role ? profile.role.toLowerCase() : ''
    const allowedRoles = ['account', 'founder', 'admin', 'partner']
    
    if (!allowedRoles.includes(role)) {
       return res.status(403).json({ error: 'Unauthorized: Finance Role Required' })
    }

    const { pvId, category } = req.body
    if (!pvId || !category) return res.status(400).json({ error: 'Missing required fields' })

    const { data: pv, error: fetchError } = await supabaseAdmin
        .from('payment_vouchers')
        .select('id, status, category, firm_id')
        .eq('id', pvId)
        .eq('firm_id', firmId)
        .single()

    if (fetchError || !pv) return res.status(404).json({ error: 'PV Not Found' })
    
    // Status Check: Must be 'Submitted' (or Categorized for re-categorization)
    // We allow re-categorization if it's already categorized or submitted
    if (!['Submitted', 'Categorized'].includes(pv.status)) {
         return res.status(400).json({ error: 'Invalid State: PV must be Submitted or Categorized' })
    }

    const { error: updateError } = await supabaseAdmin
        .from('payment_vouchers')
        .update({ 
            category, 
            status: 'Categorized',
            categorized_by: userId,
            categorized_at: new Date().toISOString()
        })
        .eq('id', pvId)

    if (updateError) throw updateError

    await logAudit({
        action: 'ASSIGN_CATEGORY',
        tableName: 'payment_vouchers',
        recordId: pvId,
        oldData: { category: pv.category, status: pv.status },
        newData: { category, status: 'Categorized' },
        userId,
        firmId,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    })

    return res.status(200).json({ success: true, message: 'Category Assigned' })

  } catch (error) {
    console.error('Assign Category Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
