import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // GET: List variables (optionally filter by status)
  if (req.method === 'GET') {
    const { status, firm_id } = req.query
    let query = supabase.from('variable_dictionary').select('*')
    if (firm_id) query = query.eq('firm_id', firm_id)
    if (status) query = query.eq('status', status)
    
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST: Propose or Approve/Reject
  const { action, variable_id, variable_name, description, firm_id, created_by } = req.body

  if (!action) return res.status(400).json({ error: 'Action required' })

  try {
    if (action === 'propose') {
        if (!variable_name || !firm_id || !created_by) {
            return res.status(400).json({ error: 'Missing fields for proposal' })
        }
        // Check if variable exists
        const { data: existing } = await supabase
            .from('variable_dictionary')
            .select('id')
            .eq('firm_id', firm_id)
            .eq('variable_name', variable_name)
            .single()
        
        if (existing) {
            return res.status(409).json({ error: 'Variable already exists' })
        }

        const { data, error } = await supabase
            .from('variable_dictionary')
            .insert({
                firm_id,
                variable_name,
                description,
                created_by,
                status: 'pending' // Default to pending
            })
            .select()
            .single()
        
        if (error) throw error
        return res.status(201).json(data)

    } else if (action === 'approve' || action === 'reject') {
        if (!variable_id) return res.status(400).json({ error: 'Variable ID required' })
        
        const newStatus = action === 'approve' ? 'approved' : 'rejected'
        const { data, error } = await supabase
            .from('variable_dictionary')
            .update({ status: newStatus })
            .eq('id', variable_id)
            .select()
            .single()
            
        if (error) throw error
        return res.status(200).json(data)
    } else {
        return res.status(400).json({ error: 'Invalid action' })
    }

  } catch (error) {
    console.error('Dictionary Governance Error:', error)
    res.status(500).json({ error: error.message })
  }
}
