import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../_utils/auth.js'
import { logAudit } from '../../_utils/audit.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId, profile } = await verifyUser(req)

    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing ID' })

    // Check PV existence and firm
    const { data: pv, error: fetchError } = await supabaseAdmin
        .from('payment_vouchers')
        .select('*')
        .eq('id', id)
        .eq('firm_id', firmId)
        .single()

    if (fetchError || !pv) return res.status(404).json({ error: 'PV Not Found' })

    // Rule: Can only delete 'Draft'
    if (pv.status !== 'Draft') {
        return res.status(400).json({ error: 'Cannot delete PV that is not in Draft' })
    }
    
    const { error: deleteError } = await supabaseAdmin
        .from('payment_vouchers')
        .delete()
        .eq('id', id)

    if (deleteError) throw deleteError

    await logAudit({
        action: 'DELETE_PV',
        tableName: 'payment_vouchers',
        recordId: id,
        oldData: pv,
        newData: null,
        userId,
        firmId,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    })

    return res.status(200).json({ success: true, message: 'PV Deleted' })

  } catch (error) {
    console.error('Delete PV Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
