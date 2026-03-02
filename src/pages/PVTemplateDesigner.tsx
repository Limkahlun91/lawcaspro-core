import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { 
  FileText, Printer, Type, Move, Sliders, Grid, 
  Maximize2, Minimize2, Save, ArrowLeft, Trash2, Plus
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useRole, currentRole } from '../context/RoleContext'

export default function PVTemplateDesigner() {
  const navigate = useNavigate()
  const outlet = useOutletContext<{ isMobile: boolean } | undefined>()
  const { isMobile } = outlet || { isMobile: false }
  
  const { user, profile } = useAuth()
  const roleState = useRole()
  const userRole = currentRole(roleState)

  const editorRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState<string>('')
  const [templateName, setTemplateName] = useState('New PV Template')
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  
  const [variables] = useState([
    { key: 'payee_name', label: 'Payee Name' },
    { key: 'amount', label: 'Amount (RM)' },
    { key: 'amount_words', label: 'Amount (Words)' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'date', label: 'Date' },
    { key: 'case_refs', label: 'Linked Cases List' },
    { key: 'created_by', label: 'Prepared By' },
    { key: 'pv_no', label: 'PV Number' },
    { key: 'payment_type', label: 'Payment Type' },
    { key: 'category', label: 'Category' }
  ])

  // Mock Data for Preview
  const mockPV = {
    payee_name: 'Tenaga Nasional Berhad',
    amount: '1,250.00',
    amount_words: 'One Thousand Two Hundred Fifty Ringgit Only',
    purpose: 'Electricity Bill for January 2026',
    date: '01/03/2026',
    case_refs: `
      <ul>
        <li><strong>LC/SPA/2026/001</strong> - Tan Ah Seng (Unit A-10-05)</li>
        <li><strong>LC/SPA/2026/002</strong> - Lim & Co (Unit B-12-01)</li>
      </ul>
    `,
    created_by: 'Lim Kah Lun',
    pv_no: 'PV-2026-0042',
    payment_type: 'Online Transfer',
    category: 'Utility'
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    if (!profile?.firm_id) return
    const { data, error } = await supabase
      .from('pv_templates')
      .select('*')
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })
    
    if (data) setTemplates(data)
  }

  const handleSave = async () => {
    if (!user || !profile?.firm_id) return
    if (!templateName.trim()) return alert('Please enter a template name')

    const payload = {
      firm_id: profile.firm_id,
      name: templateName,
      html_content: content,
      updated_at: new Date().toISOString()
    }

    try {
      if (selectedTemplateId) {
        // Update
        const { error } = await supabase
          .from('pv_templates')
          .update(payload)
          .eq('id', selectedTemplateId)
        if (error) throw error
      } else {
        // Create
        const { data, error } = await supabase
          .from('pv_templates')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        if (data) setSelectedTemplateId(data.id)
      }
      
      alert('Template saved successfully!')
      fetchTemplates()
    } catch (e: any) {
      alert('Error saving template: ' + e.message)
    }
  }

  const handleLoadTemplate = (t: any) => {
    setSelectedTemplateId(t.id)
    setTemplateName(t.name)
    setContent(t.html_content || '')
    setMode('edit')
  }

  const handleNewTemplate = () => {
    setSelectedTemplateId(null)
    setTemplateName('New PV Template')
    setContent('')
    setMode('edit')
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    const { error } = await supabase
      .from('pv_templates')
      .delete()
      .eq('id', id)
    
    if (error) {
      alert('Error deleting template')
    } else {
      fetchTemplates()
      if (selectedTemplateId === id) handleNewTemplate()
    }
  }

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', `{{${key}}}`)
  }

  const getPreviewContent = () => {
    let preview = content
    variables.forEach(v => {
      const regex = new RegExp(`{{${v.key}}}`, 'g')
      // @ts-ignore
      let value = mockPV[v.key] || `{{${v.key}}}`
      preview = preview.replace(regex, value)
    })
    return preview
  }

  const sanitizeHTML = (html: string) => {
    if (typeof window === 'undefined') return html
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'div','p','strong','h1','h2','h3', 'h4', 'table', 'tr', 'td', 'th', 'tbody', 'thead',
          'span','br','ul','li','b','i','u','ol', 'hr', 'img'
        ],
        ALLOWED_ATTR: ['class','style', 'src', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align'],
        FORBID_ATTR: ['onerror','onclick','onload'],
        ALLOWED_URI_REGEXP: /^https?:|^data:/
    })
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gray-100">
      {/* Sidebar - Templates & Variables */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
           <button onClick={() => navigate('/payment-vouchers')} className="flex items-center gap-2 text-gray-500 hover:text-[#003366] mb-4 text-sm font-bold">
             <ArrowLeft size={16} /> Back to PV List
           </button>
           <h2 className="text-xl font-bold text-[#003366] flex items-center gap-2">
             <Sliders size={20} /> PV Designer
           </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Templates List */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saved Templates</h3>
              <button onClick={handleNewTemplate} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="New Template">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-1">
              {templates.map(t => (
                <div key={t.id} className={`group flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer ${selectedTemplateId === t.id ? 'bg-blue-50 text-[#003366] font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                   <span onClick={() => handleLoadTemplate(t)} className="truncate flex-1">{t.name}</span>
                   <button onClick={() => handleDeleteTemplate(t.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1">
                     <Trash2 size={14} />
                   </button>
                </div>
              ))}
              {templates.length === 0 && <p className="text-xs text-gray-400 italic">No templates yet.</p>}
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Variables List */}
          <div>
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Drag Variables</h3>
             <div className="space-y-2">
                {variables.map(v => (
                  <div 
                    key={v.key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, v.key)}
                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-move hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-2 group"
                  >
                    <Type size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="text-sm font-bold text-gray-700">{v.label}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{`{{${v.key}}}`}</p>
                    </div>
                  </div>
                ))}
             </div>
             <p className="text-[10px] text-gray-400 mt-2 italic">
               Tip: Drag variables into the editor to insert dynamic fields.
             </p>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Toolbar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
           <div className="flex items-center gap-4 flex-1">
              <input 
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="text-lg font-bold text-gray-800 outline-none border-b border-transparent hover:border-gray-300 focus:border-[#003366] bg-transparent w-full max-w-md transition-colors"
                placeholder="Template Name..."
              />
           </div>
           
           <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
                <button 
                  onClick={() => setMode('edit')}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'edit' ? 'bg-[#003366] text-white shadow' : 'text-gray-600'}`}
                >
                  Editor
                </button>
                <button 
                  onClick={() => setMode('preview')}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'preview' ? 'bg-[#003366] text-white shadow' : 'text-gray-600'}`}
                >
                  Preview
                </button>
              </div>

              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855] font-bold shadow-md active:scale-95 transition-transform"
              >
                <Save size={18} /> Save Template
              </button>
           </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center">
            <div 
              className="bg-white shadow-2xl w-[210mm] min-h-[148mm] relative transition-all" // A5 Landscape or A4 Portrait depending on preference. A5 is standard for PV.
              style={{ padding: '40px' }}
              onDrop={(e) => {
                e.preventDefault()
                const key = e.dataTransfer.getData('text/plain')
                if (key && mode === 'edit') {
                   document.execCommand('insertText', false, key)
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {mode === 'edit' ? (
                <div 
                  className="w-full h-full outline-none min-h-[400px]"
                  contentEditable
                  onInput={(e) => setContent(e.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }}
                />
              ) : (
                <div 
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(getPreviewContent()) }}
                />
              )}
            </div>
        </div>
      </div>
    </div>
  )
}
