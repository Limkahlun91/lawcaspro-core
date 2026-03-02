import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../_utils/auth.js'
import { logAudit } from '../../_utils/audit.js'
import { getRequiredRoles } from '../../_utils/rule-evaluator.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId, profile } = await verifyUser(req)
    const userRole = profile.role ? profile.role.toLowerCase() : ''
    
    const { pvId } = req.body
    if (!pvId) return res.status(400).json({ error: 'Missing pvId' })

    // 1. Fetch PV Data
    const { data: pv, error: fetchError } = await supabaseAdmin
        .from('payment_vouchers')
        .select('*')
        .eq('id', pvId)
        .eq('firm_id', firmId)
        .single()

    if (fetchError || !pv) return res.status(404).json({ error: 'PV Not Found' })

    // 2. Fetch Payment Rules
    // Use module 'payment_execution' or reuse 'payment_voucher' with a different field check?
    // Let's assume we use 'payment_voucher' module but maybe different rules apply.
    // For now, use same module.
    const { data: rules, error: rulesError } = await supabaseAdmin
        .from('approval_rules')
        .select('*')
        .eq('firm_id', firmId)
        .eq('module', 'payment_voucher') // Or 'payment_execution' if we want separate rules

    // 3. Evaluate Rules
    // Base: Account, Founder, Admin, Partner
    let requiredRoles = ['account', 'founder', 'admin', 'partner']
    
    const dynamicRoles = getRequiredRoles(rules || [], pv)
    
    if (dynamicRoles.length > 0) {
        // If high amount rule exists (e.g. > 100k needs Founder), it will return ['founder']
        requiredRoles = dynamicRoles
    }

    // 4. Check Permissions
    if (!requiredRoles.includes(userRole)) {
       return res.status(403).json({ 
           error: 'Unauthorized: High Value Payment Restriction', 
           details: `Payment requires one of: ${requiredRoles.join(', ')}`,
           required_roles: requiredRoles
       })
    }

    // 5. Execute
    const { data, error } = await supabaseAdmin.rpc('mark_payment_voucher_paid', {
        p_pv_id: pvId,
        p_user_id: userId
    })

    if (error) throw error

    await logAudit({
        action: 'PAY_PV',
        tableName: 'payment_vouchers',
        recordId: pvId,
        oldData: { status: pv.status },
        newData: { status: 'Paid' },
        userId,
        firmId,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    })

    return res.status(200).json({ success: true, message: 'PV Paid', data })

  } catch (error) {
    console.error('Pay Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
