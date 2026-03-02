import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { template_id, action, actor_id, comments } = req.body

  if (!template_id || !action || !actor_id) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const validActions = ['submit', 'approve', 'reject', 'publish', 'revert']
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' })
  }

  try {
    // 1. Get current template status and version
    const { data: template, error: fetchError } = await supabase
      .from('firm_templates')
      .select('status, version, firm_id')
      .eq('id', template_id)
      .single()

    if (fetchError || !template) {
      throw new Error('Template not found')
    }

    // 2. Validate transition
    let newStatus = template.status
    if (action === 'submit') {
      // Allow submission from draft, mapping, designing, or rejected states
      if (!['draft', 'mapping', 'rejected', 'designing', 'invalid'].includes(template.status)) {
        throw new Error(`Cannot submit from status: ${template.status}`)
      }
      newStatus = 'submitted'
    } else if (action === 'approve') {
      if (template.status !== 'submitted') {
        throw new Error(`Cannot approve from status: ${template.status}`)
      }
      newStatus = 'approved'
    } else if (action === 'reject') {
      if (template.status !== 'submitted') {
        throw new Error(`Cannot reject from status: ${template.status}`)
      }
      newStatus = 'rejected'
    } else if (action === 'publish') {
      if (template.status !== 'approved') {
        throw new Error(`Cannot publish from status: ${template.status}`)
      }
      newStatus = 'ready'
    } else if (action === 'revert') {
        // Allow reverting to draft from any state if needed (admin override)
        newStatus = 'draft'
    }

    // 3. Update Template Status
    const { error: updateError } = await supabase
      .from('firm_templates')
      .update({ status: newStatus })
      .eq('id', template_id)

    if (updateError) throw updateError

    // 4. Log Action
    const { error: logError } = await supabase
      .from('template_approval_logs')
      .insert({
        firm_id: template.firm_id,
        template_id: template_id,
        version: template.version, // Log current version
        action: action,
        actor_id: actor_id,
        comments: comments
      })

    if (logError) {
      console.error('Failed to log approval action:', logError)
      // In production, consider rolling back or alerting
    }

    res.status(200).json({ 
      success: true, 
      new_status: newStatus,
      message: `Template ${action} successfully`
    })

  } catch (error) {
    console.error('Workflow Error:', error)
    res.status(500).json({ error: error.message })
  }
}
