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
    // 1. Zero Trust: Verify User
    const { user, firmId, userId, profile } = await verifyUser(req)
    const userRole = profile.role ? profile.role.toLowerCase() : ''

    const { pvId } = req.body
    if (!pvId) return res.status(400).json({ error: 'Missing pvId' })

    // 2. Fetch PV Data (for Rule Engine)
    const { data: pv, error: fetchError } = await supabaseAdmin
        .from('payment_vouchers')
        .select('*')
        .eq('id', pvId)
        .eq('firm_id', firmId)
        .single()

    if (fetchError || !pv) return res.status(404).json({ error: 'PV Not Found' })

    // 3. Fetch Approval Rules
    const { data: rules, error: rulesError } = await supabaseAdmin
        .from('approval_rules')
        .select('*')
        .eq('firm_id', firmId)
        .eq('module', 'payment_voucher')

    if (rulesError) console.error('Error fetching rules:', rulesError)

    // 4. Evaluate Rules
    // Base Requirement: Partner or Founder or Admin (Hardcoded Minimum)
    // The Rule Engine adds *stricter* requirements (e.g. Amount > 50k -> Founder)
    let requiredRoles = ['partner', 'founder', 'admin']
    
    const dynamicRoles = getRequiredRoles(rules || [], pv)
    
    if (dynamicRoles.length > 0) {
        // If rules are triggered, they OVERRIDE or INTERSECT?
        // Usually, dynamic rules are "Specific Requirements".
        // If a rule says "Founder", then "Partner" is no longer enough.
        // So we should probably use the dynamic roles as the source of truth if any match.
        // Or, we check if the user has ANY of the required roles.
        
        // Logic: "The user must have ONE of the required roles"
        // If rule says ["founder"], user must be founder.
        // If rule says ["partner", "founder"], user can be either.
        requiredRoles = dynamicRoles
    }

    // 5. Check Permissions
    // User role must be in requiredRoles
    if (!requiredRoles.includes(userRole)) {
       return res.status(403).json({ 
           error: 'Unauthorized: Insufficient Privileges',
           details: `Approval requires one of: ${requiredRoles.join(', ')}`,
           required_roles: requiredRoles
       })
    }

    // 6. Call RPC (Admin Context)
    const { data, error } = await supabaseAdmin.rpc('approve_payment_voucher', {
        p_pv_id: pvId,
        p_user_id: userId
    })

    if (error) throw error

    // 7. Audit Log
    await logAudit({
        action: 'APPROVE_PV',
        tableName: 'payment_vouchers',
        recordId: pvId,
        oldData: { status: pv.status },
        newData: { status: 'Approved' },
        userId,
        firmId,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    })

    return res.status(200).json({ success: true, message: 'PV Approved', data })

  } catch (error) {
    console.error('Approve Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
