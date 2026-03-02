import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { file_hash, document_id } = req.body

  if (!file_hash) {
    return res.status(400).json({ error: 'File hash is required' })
  }

  try {
    // 1. Search for document by hash
    let query = supabase
      .from('generated_documents')
      .select(`
        id,
        generated_at,
        status,
        template:firm_templates(name),
        generated_by,
        file_hash
      `)
      .eq('file_hash', file_hash)
      .eq('status', 'completed') // Only valid completed docs

    if (document_id) {
      query = query.eq('id', document_id)
    }

    const { data: matches, error } = await query

    if (error) throw error

    if (!matches || matches.length === 0) {
      return res.status(200).json({ 
        verified: false, 
        message: 'No matching document found with this hash.' 
      })
    }

    // 2. Return verification details
    return res.status(200).json({
      verified: true,
      match_count: matches.length,
      matches: matches.map(m => ({
        document_id: m.id,
        template_name: m.template?.name,
        generated_at: m.generated_at,
        generated_by: m.generated_by
      }))
    })

  } catch (error) {
    console.error('Integrity Verification Error:', error)
    res.status(500).json({ error: error.message })
  }
}
