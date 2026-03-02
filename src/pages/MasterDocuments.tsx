import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { FileText, Upload, Trash2, Download, Shield, Building } from 'lucide-react'

interface Template {
  id: string
  name: string
  file_url: string
  file_type: string
  source: 'global' | 'firm'
  is_active: boolean
  created_at: string
  version?: number
  is_latest?: boolean
  status?: 'draft' | 'ready' | 'archived' | 'mapping' | 'designing' | 'invalid'
  render_engine?: 'docx_templater' | 'pdf_acroform'
}

export default function MasterDocuments() {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'system' | 'firm'>('system')
  const [templates, setTemplates] = useState<{ global: Template[], firm: Template[] }>({ global: [], firm: [] })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  // PDF Mapping Modal State
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [currentMappingTemplate, setCurrentMappingTemplate] = useState<Template | null>(null)
  const [mappings, setMappings] = useState<any[]>([])
  const [variableDictionary, setVariableDictionary] = useState<any[]>([])

  // Variable Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)
  const [pendingVariables, setPendingVariables] = useState<any[]>([])
  const [pendingSource, setPendingSource] = useState<'global' | 'firm'>('firm')

  // Roles
  const role = profile?.role?.toLowerCase() || ''
  const isFounder = role === 'founder' || role === 'admin'
  const isFirmAdmin = ['partner', 'lawyer', 'founder', 'admin'].includes(role)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const res = await fetch('/api/docs/templates/list', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const { data } = await res.json()
      if (data) setTemplates(data)
    } catch (err) {
      console.error('Fetch templates error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'global' | 'firm') => {
    const file = e.target.files?.[0]
    if (!file || !session?.access_token) return

    setUploading(true)
    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      
      // LEVEL 7 SECURITY: Use firm_id in path for isolation
      let filePath = ''
      if (source === 'global') {
          filePath = `global/${fileName}`
      } else {
          // Ensure we have firm_id
          const firmId = profile?.firm_id || session?.user?.user_metadata?.firm_id
          if (!firmId) throw new Error("Firm ID not found")
          filePath = `${firmId}/${fileName}`
      }

      const { error: uploadError } = await supabase.storage
        .from('legal-docs')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('legal-docs')
        .getPublicUrl(filePath)

      // 2. Call API
      const res = await fetch('/api/docs/templates/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: file.name,
          folder_name: 'General',
          file_url: publicUrl,
          file_type: fileExt || 'docx',
          source
        })
      })

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Upload failed')
      }
      
      const { data, variables } = await res.json()
      
      await fetchTemplates()
      
      // Check if we need to confirm variables
      // If any variable is not confirmed (is_confirmed: false), open modal
      if (variables && variables.some((v: any) => !v.is_confirmed)) {
          setPendingVariables(variables)
          setPendingTemplateId(data.id)
          setPendingSource(source)
          setConfirmModalOpen(true)
      } else {
          alert(`Template uploaded and ready! Detected ${variables?.length || 0} variables.`)
      }

    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  const openConfirmationModal = async (templateId: string, source: 'global' | 'firm') => {
      setLoading(true)
      try {
          const { data, error } = await supabase
              .from('template_variables')
              .select('*')
              .eq('template_id', templateId)
          
          if (error) throw error

          setPendingVariables(data || [])
          setPendingTemplateId(templateId)
          setPendingSource(source)
          setConfirmModalOpen(true)
      } catch (err) {
          console.error("Fetch variables error:", err)
          alert("Failed to load variables")
      } finally {
          setLoading(false)
      }
  }

  const handleConfirmVariable = async (variableId: string, confirmed: boolean) => {
      // Optimistic update
      setPendingVariables(prev => prev.map(v => v.id === variableId ? { ...v, is_confirmed: confirmed } : v))
  }

  const saveVariableConfirmation = async () => {
      if (!pendingTemplateId || !pendingVariables.length) return
      
      try {
          // Bulk update (simulated by loop for now or single RPC if available)
          // Better to use an API endpoint for bulk update to ensure transaction
          // For now, let's update one by one or creating a new endpoint is better.
          // Let's create a quick API for this: /api/docs/templates/confirm-variables
          
          const res = await fetch('/api/docs/templates/confirm-variables', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                  templateId: pendingTemplateId,
                  source: pendingSource,
                  variables: pendingVariables.map(v => ({ id: v.id, is_confirmed: v.is_confirmed }))
              })
          })
          
          if (!res.ok) throw new Error('Update failed')
          
          setConfirmModalOpen(false)
          setPendingTemplateId(null)
          fetchTemplates()
          alert("Variables confirmed! Template status updated.")
          
      } catch (err) {
          console.error("Save confirmation error:", err)
          alert("Failed to save confirmations")
      }
  }

  // PDF Mapping Functions
  const openMappingModal = async (template: Template) => {
    setLoading(true)
    try {
        const res = await fetch(`/api/docs/pdf/mappings?template_id=${template.id}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` }
        })
        const data = await res.json()
        
        if (!res.ok) throw new Error(data.error)
        
        setMappings(data.mappings)
        setVariableDictionary(data.dictionary)
        setCurrentMappingTemplate(template)
        setMappingModalOpen(true)
    } catch (err) {
        console.error("Fetch mappings error:", err)
        alert("Failed to load mappings")
    } finally {
        setLoading(false)
    }
  }

  const handleMappingChange = (id: string, field: string, value: any) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const saveMappings = async (publish: boolean = false) => {
    if (!currentMappingTemplate) return
    setLoading(true)
    try {
        const res = await fetch('/api/docs/pdf/mappings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
                template_id: currentMappingTemplate.id,
                mappings: mappings,
                status: publish ? 'ready' : undefined,
                template_source: currentMappingTemplate.source
            })
        })
        
        if (!res.ok) throw new Error('Save failed')
        
        setMappingModalOpen(false)
        fetchTemplates()
        alert(publish ? "Template published!" : "Mappings saved.")
    } catch (err) {
        console.error("Save mappings error:", err)
        alert("Failed to save mappings")
    } finally {
        setLoading(false)
    }
  }

  const handleDelete = async (id: string, source: 'global' | 'firm') => {
    if (!confirm('Are you sure you want to delete this template?')) return
    if (!session?.access_token) return

    try {
      const res = await fetch('/api/docs/templates/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, source })
      })

      if (!res.ok) throw new Error('Delete failed')
      
      await fetchTemplates()

    } catch (err) {
      console.error('Delete error:', err)
      alert('Delete failed')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Template Variables</h3>
                <p className="text-sm text-gray-500 mb-6">
                    The system detected the following variables. Please confirm the mapping. 
                    <br/>
                    <span className="text-red-500 font-medium">Warning:</span> Only confirmed variables will be used in generation.
                </p>
                
                <div className="space-y-4 mb-6">
                    {pendingVariables.map(v => (
                        <div key={v.variable_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div>
                                <p className="font-mono text-sm font-bold text-[#003366]">{`{{${v.variable_key}}}`}</p>
                                <p className="text-xs text-gray-500">
                                    Auto-Mapped to: <span className="font-medium text-gray-700">{v.case_field || 'No match'}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={v.is_confirmed} 
                                        onChange={(e) => handleConfirmVariable(v.id, e.target.checked)}
                                        className="w-4 h-4 text-[#003366] rounded border-gray-300 focus:ring-[#003366]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Confirm</span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setConfirmModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancel (Save Draft)
                    </button>
                    <button 
                        onClick={saveVariableConfirmation}
                        className="px-4 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855]"
                    >
                        Save & Confirm
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* PDF Mapping Modal */}
      {mappingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">PDF Field Mapping Workbench</h3>
                        <p className="text-sm text-gray-500">
                            Map the PDF form fields to system variables or set static values.
                        </p>
                    </div>
                    <button onClick={() => setMappingModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <span className="sr-only">Close</span>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF Field Name</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Map to Variable</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Or Static Value</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {mappings.map((m) => (
                                <tr key={m.id}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {m.pdf_field_name}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <select 
                                            value={m.variable_key || ''} 
                                            onChange={(e) => handleMappingChange(m.id, 'variable_key', e.target.value || null)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-1"
                                        >
                                            <option value="">-- Select Variable --</option>
                                            {variableDictionary.map(d => (
                                                <option key={d.variable_key} value={d.variable_key}>
                                                    {d.variable_key} ({d.description})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <input 
                                            type="text" 
                                            value={m.static_value || ''}
                                            onChange={(e) => handleMappingChange(m.id, 'static_value', e.target.value)}
                                            placeholder="Static value..."
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-1"
                                            disabled={!!m.variable_key}
                                        />
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <input 
                                            type="checkbox" 
                                            checked={m.is_required} 
                                            onChange={(e) => handleMappingChange(m.id, 'is_required', e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button 
                        onClick={() => saveMappings(false)}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Save Draft
                    </button>
                    <button 
                        onClick={() => saveMappings(true)}
                        className="px-4 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855]"
                    >
                        Publish (Set as Ready)
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#003366] flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Master Documents Library
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'system'
              ? 'border-b-2 border-[#003366] text-[#003366]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          System Templates
        </button>
        <button
          onClick={() => setActiveTab('firm')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'firm'
              ? 'border-b-2 border-[#003366] text-[#003366]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building className="w-4 h-4" />
          Firm Templates
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="font-bold text-gray-700">
            {activeTab === 'system' ? 'Global Standard Library' : 'Firm Private Library'}
          </h2>
          
          {/* Upload Button Logic */}
          {((activeTab === 'system' && isFounder) || (activeTab === 'firm' && isFirmAdmin)) && (
            <div className="relative">
              <input
                type="file"
                id="template-upload"
                className="hidden"
                accept=".docx,.pdf"
                onChange={(e) => handleUpload(e, activeTab === 'system' ? 'global' : 'firm')}
                disabled={uploading}
              />
              <label
                htmlFor="template-upload"
                className={`flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855] cursor-pointer transition-colors ${uploading ? 'opacity-50' : ''}`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Template'}
              </label>
            </div>
          )}
        </div>

        {/* List */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading templates...</div>
          ) : (
            <div className="grid gap-2">
              {(activeTab === 'system' ? templates.global : templates.firm).length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  No templates found in this library.
                </div>
              ) : (
                (activeTab === 'system' ? templates.global : templates.firm).map((tmpl) => (
                  <div key={tmpl.id} className="flex items-center justify-between p-4 hover:bg-gray-50 border border-gray-100 rounded-lg transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tmpl.file_type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          {tmpl.name}
                          {tmpl.version && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                              v{tmpl.version}
                            </span>
                          )}
                          {tmpl.status && (
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                tmpl.status === 'ready' ? 'bg-green-100 text-green-700' :
                                tmpl.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-500'
                            }`}>
                              {tmpl.status.toUpperCase()}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(tmpl.created_at).toLocaleDateString()} • {tmpl.file_type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-gray-400 hover:text-[#003366] rounded-full hover:bg-gray-100" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                      
                      {/* Delete Button Logic */}
                      {((activeTab === 'system' && isFounder) || (activeTab === 'firm' && isFirmAdmin)) && (
                        <>
                          <div className="relative">
                             <input
                                type="file"
                                id={`new-version-${tmpl.id}`}
                                className="hidden"
                                accept=".docx,.pdf"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) {
                                        // Reuse handleUpload logic but with parent_template_id
                                        // Need to refactor handleUpload to accept extra params or duplicate logic
                                        // Let's create a quick wrapper
                                        const uploadNewVersion = async () => {
                                            if (!session?.access_token) return
                                            setUploading(true)
                                            try {
                                                const fileExt = file.name.split('.').pop()
                                                const fileName = `${Date.now()}_v_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
                                                const filePath = `${tmpl.source}/${fileName}`

                                                const { error: uploadError } = await supabase.storage
                                                    .from('legal-docs')
                                                    .upload(filePath, file)

                                                if (uploadError) throw uploadError

                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('legal-docs')
                                                    .getPublicUrl(filePath)

                                                const res = await fetch('/api/docs/templates/upload', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: `Bearer ${session.access_token}`
                                                    },
                                                    body: JSON.stringify({
                                                        name: file.name, // Or keep original name? usually new file name
                                                        folder_name: 'General',
                                                        file_url: publicUrl,
                                                        file_type: fileExt || 'docx',
                                                        source: tmpl.source,
                                                        parent_template_id: tmpl.id // Link to previous version
                                                    })
                                                })

                                                if (!res.ok) throw new Error('Upload failed')
                                                
                                                const { variables } = await res.json()
                                                await fetchTemplates()
                                                alert(`New version uploaded! Detected ${variables?.length || 0} variables.`)
                                            } catch (err) {
                                                console.error('Upload error:', err)
                                                alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
                                            } finally {
                                                setUploading(false)
                                            }
                                        }
                                        uploadNewVersion();
                                    }
                                }}
                                disabled={uploading}
                             />
                             <label 
                               htmlFor={`new-version-${tmpl.id}`}
                               className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 cursor-pointer block"
                               title="Upload New Version"
                             >
                               <Upload className="w-4 h-4" />
                             </label>
                          </div>

                          <button 
                            onClick={() => handleDelete(tmpl.id, tmpl.source)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50" 
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Manage Variables for Draft */}
                          {tmpl.status === 'draft' && (
                             <button
                                onClick={() => openConfirmationModal(tmpl.id, tmpl.source)}
                                className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                             >
                                Confirm Variables
                             </button>
                          )}

                          {/* Map Fields for PDF Mapping */}
                          {tmpl.status === 'mapping' && (
                             <button
                                onClick={() => openMappingModal(tmpl)}
                                className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                             >
                                Map Fields
                             </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
