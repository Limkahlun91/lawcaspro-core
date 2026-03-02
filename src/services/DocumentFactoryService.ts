import { supabase } from '../lib/supabaseClient'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// Types based on SQL Schema
export interface Template {
  id: string
  firm_id: string
  category: string
  template_name: string
  file_format: 'docx' | 'pdf'
  storage_path: string
  version: number
  active: boolean
  created_at: string
}

export interface TemplateVariable {
  id: string
  template_id: string
  variable_key: string
  data_type: 'string' | 'date' | 'currency' | 'address' | 'nric'
  required: boolean
  priority_rule: string
}

export interface CaseDataSource {
  id: string
  case_id: string
  field_name: string
  value: string
  source: string
  confidence_score: number
}

export interface ResolvedField {
  id: string
  case_id: string
  field_name: string
  final_value: string
  resolved_by: string
  resolved_at: string
}

export interface DocumentRecord {
  id: string
  firm_id: string
  case_id: string
  template_id: string
  file_name: string
  storage_path: string
  version: number
  generated_by: string
  generated_at: string
}

export interface PrintRule {
  id: string
  template_id: string
  default_print_mode: 'single' | 'duplex'
  paper_size: string
  copies: number
}

export interface TempCaseStaging {
  id: string
  firm_id: string
  raw_source: 'IC_UPLOAD' | 'LO_UPLOAD' | 'BOOKING_FORM'
  extracted_json: any
  ai_confidence: number
  status: 'pending' | 'confirmed' | 'rejected'
  created_by: string
  created_at: string
}

// Service Class
class DocumentFactoryService {
  
  // --- New Intake Methods ---

  // 1. Submit to Staging
  async submitToStaging(firmId: string, source: string, extractedData: any, confidence: number): Promise<string> {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('temp_case_staging').insert({
          firm_id: firmId,
          raw_source: source,
          extracted_json: extractedData,
          ai_confidence: confidence,
          status: 'pending',
          created_by: user?.id
      }).select('id').single()

      if (error) throw error
      return data.id
  }

  // 2. Confirm Staging & Create Case
  async confirmStaging(stagingId: string, finalData: Record<string, any>): Promise<string> {
      const { data: staging } = await supabase.from('temp_case_staging').select('*').eq('id', stagingId).single()
      if (!staging) throw new Error('Staging record not found')

      // 1. Create Case via API
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/cases/create', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
              title: finalData.property_address || 'New Intake Case',
              client_name: finalData.purchaser_name,
              fileRef: `LC/${new Date().getFullYear()}/${Math.floor(Math.random() * 1000)}`,
              status: 'Open',
              description: `Project: New Intake Project. Loan Amount: ${finalData.loan_amount || 0}`,
              spa_price: finalData.spa_price || 0,
              unit_no: finalData.unit_no
          })
      })

      if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create case')
      }

      const { case: newCase } = await response.json()

      // 2. Insert into Data Sources
      const sourcesToInsert = Object.entries(finalData).map(([key, val]) => ({
          case_id: newCase.id,
          field_name: key,
          value: String(val),
          source: staging.raw_source,
          confidence_score: staging.ai_confidence || 1.0
      }))

      const { error: sourceError } = await supabase.from('case_data_sources').insert(sourcesToInsert)
      if (sourceError) console.error('Failed to insert sources', sourceError)

      // 3. Update Staging Status
      await supabase.from('temp_case_staging').update({ status: 'confirmed' }).eq('id', stagingId)

      return newCase.id
  }

  // 1. Conflict Check
  async conflictCheck(caseId: string): Promise<{ field: string, values: string[] }[]> {
    const { data, error } = await supabase
      .from('case_data_sources')
      .select('field_name, value')
      .eq('case_id', caseId)

    if (error) throw error

    const grouped: Record<string, Set<string>> = {}
    data?.forEach(item => {
      if (!grouped[item.field_name]) grouped[item.field_name] = new Set()
      grouped[item.field_name].add(item.value)
    })

    const conflicts: { field: string, values: string[] }[] = []
    for (const [field, values] of Object.entries(grouped)) {
      if (values.size > 1) {
        conflicts.push({ field, values: Array.from(values) })
      }
    }
    return conflicts
  }

  // 2. Resolve Field
  async resolveField(caseId: string, fieldName: string, finalValue: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('resolved_fields')
      .upsert({
        case_id: caseId,
        field_name: fieldName,
        final_value: finalValue,
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      }, { onConflict: 'case_id, field_name' })

    if (error) throw error
  }

  // 3. Variable Injection Engine
  async getResolvedVariables(caseId: string, templateId: string): Promise<Record<string, string>> {
    // 1. Get Template Variables
    const { data: vars } = await supabase
      .from('template_variables')
      .select('*')
      .eq('template_id', templateId)

    if (!vars) return {}

    const result: Record<string, string> = {}

    // 2. Fetch Data Sources
    const { data: resolved } = await supabase
      .from('resolved_fields')
      .select('field_name, final_value')
      .eq('case_id', caseId)
    
    const { data: sources } = await supabase
      .from('case_data_sources')
      .select('*')
      .eq('case_id', caseId)
      .order('confidence_score', { ascending: false })

    // 3. Inject
    for (const v of vars) {
      // Priority 1: Resolved Fields
      const res = resolved?.find(r => r.field_name === v.variable_key)
      if (res) {
        result[v.variable_key] = this.formatData(res.final_value, v.data_type)
        continue
      }

      // Priority 2: Data Sources (Highest Confidence)
      const src = sources?.find(s => s.field_name === v.variable_key)
      if (src) {
        result[v.variable_key] = this.formatData(src.value, v.data_type)
        continue
      }

      // Fallback: Empty or Placeholder
      result[v.variable_key] = `{{${v.variable_key}}}`
    }

    return result
  }

  private formatData(value: string, type: string): string {
    if (!value) return ''
    switch (type) {
      case 'currency':
        const num = parseFloat(value)
        return isNaN(num) ? value : `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
      case 'date':
        const date = new Date(value)
        return isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      case 'nric':
        return value.toUpperCase()
      case 'address':
        return value // Could add line break logic here
      default:
        return value
    }
  }

  // 4. Generate Document (Single)
  async generateDocument(caseId: string, templateId: string): Promise<{ url: string, fileName: string }> {
    const { data: template } = await supabase.from('templates').select('*').eq('id', templateId).single()
    if (!template) throw new Error('Template not found')

    // Conflict Check
    const conflicts = await this.conflictCheck(caseId)
    if (conflicts.length > 0) {
      throw new Error(`Unresolved Conflicts: ${conflicts.map(c => c.field).join(', ')}`)
    }

    // Get Variables
    const variables = await this.getResolvedVariables(caseId, templateId)

    // Simulate Template Content (In real app, fetch from Storage)
    let content = `Document: ${template.template_name}\n\n`
    for (const [key, val] of Object.entries(variables)) {
      content += `${key}: ${val}\n`
    }

    // Naming Rule
    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '.')
    const fileName = `CASE_${caseId.slice(0, 4)}_${template.template_name}_${dateStr}.${template.file_format}`

    // Upload to Storage (Simulated)
    const blob = new Blob([content], { type: 'text/plain' }) // Should be docx/pdf blob
    const storagePath = `${template.firm_id}/${caseId}/${template.category}/${fileName}`
    
    // const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, blob)
    // if (uploadError) throw uploadError

    // Insert Record
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('documents').insert({
      firm_id: template.firm_id,
      case_id: caseId,
      template_id: templateId,
      file_name: fileName,
      storage_path: storagePath,
      generated_by: user?.id
    })

    return { url: URL.createObjectURL(blob), fileName }
  }

  // 5. Batch Generate (ZIP)
  async batchGenerate(caseIds: string[], templateId: string): Promise<void> {
    const zip = new JSZip()
    const folderName = `BATCH_${new Date().toLocaleDateString('en-GB').replace(/\//g, '.')}`
    const root = zip.folder(folderName)

    for (const caseId of caseIds) {
      try {
        const { url, fileName } = await this.generateDocument(caseId, templateId)
        // Fetch blob from url
        const response = await fetch(url)
        const blob = await response.blob()
        
        // Add to Zip
        // Structure: /ClientName/File.docx
        // We need ClientName, assuming fetch from caseId
        const clientName = `Case_${caseId.slice(0, 4)}` // Mock
        const caseFolder = root?.folder(clientName)
        caseFolder?.file(fileName, blob)
      } catch (err) {
        console.error(`Failed for case ${caseId}`, err)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `${folderName}.zip`)
  }
}

export const documentFactory = new DocumentFactoryService()
