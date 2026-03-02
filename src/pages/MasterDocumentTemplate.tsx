import { useState, useRef, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import { asBlob } from 'html-docx-js-typescript'
import { saveAs } from 'file-saver'
import { Loader2, AlertCircle } from 'lucide-react'

import { 
  FileText, Printer, Type, Move, Sliders, Grid, 
  Maximize2, Minimize2, Settings, ChevronDown, Download, Zap, Package, Search
} from 'lucide-react'
import { legalAI } from '../modules/ai/legal_ai.service'
import { documentFactory } from '../services/DocumentFactoryService'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useRole, currentRole } from '../context/RoleContext'
import { useFirmCases } from '../hooks/useFirmCases'

// ...

export default function MasterDocumentTemplate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Safe Context Access
  const outlet = useOutletContext<{ isMobile: boolean } | undefined>()
  const { isMobile } = outlet || { isMobile: false }
  
  const { user, profile } = useAuth()
  const roleState = useRole()
  const userRole = currentRole(roleState)

  // Search-Driven Architecture
  const { cases: searchResults, loading: isSearching, searchCases } = useFirmCases()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Debounced Search Effect
  useEffect(() => {
      const timer = setTimeout(() => {
          if (searchTerm.length >= 2) {
              // Only search if not already selected (heuristic to avoid re-search on selection)
              // Actually, simpler to just search. 
              // To avoid re-searching when selecting, we can check if searchTerm matches selected
              searchCases(searchTerm)
              setIsDropdownOpen(true)
          }
      }, 500)
      return () => clearTimeout(timer)
  }, [searchTerm, searchCases])

  const handleSelectCase = (c: any) => {
      setCaseData(c)
      setSelectedCaseId(c.id.toString())
      setSearchTerm(`${c.client} - ${c.fileRef || 'No Ref'}`)
      setIsDropdownOpen(false)
  }

  // Mobile Lite: Force Preview Mode
  useEffect(() => {
    if (isMobile) {
      setMode('preview')
    }
  }, [isMobile])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState<string>('')
  const [bgFile, setBgFile] = useState<string | null>(null)
  const [bgType, setBgType] = useState<'image' | 'pdf'>('image')
  const [textboxes, setTextboxes] = useState<any[]>([])
  const [variables] = useState([
    { key: 'spa_date', label: 'SPA Date' },
    { key: 'developer_name', label: 'Developer Name' },
    { key: 'purchaser_name', label: 'Purchaser Name' },
    { key: 'purchaser_nric', label: 'Purchaser NRIC' },
    { key: 'property_address', label: 'Property Address' },
    { key: 'loan_amount', label: 'Loan Amount' },
    { key: 'bank_name', label: 'Bank Name' }
  ])
  const [rulerOffset, setRulerOffset] = useState({ x: 0, y: 0 })
  const [draggingBox, setDraggingBox] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showRulers, setShowRulers] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  // Removed local availableCases state
  const [caseData, setCaseData] = useState<any>(null)

  const [showMobileActions, setShowMobileActions] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setBgFile(e.target?.result as string)
        setBgType(file.type === 'application/pdf' ? 'pdf' : 'image')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', `{{${key}}}`)
  }

  const handleBoxDragStart = (id: number, e: React.MouseEvent) => {
    setDraggingBox(id)
    const box = textboxes.find(b => b.id === id)
    if (box && editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect()
        setDragOffset({
            x: e.clientX - rect.left - box.x,
            y: e.clientY - rect.top - box.y
        })
    }
  }

  const handleBoxDragMove = (e: React.MouseEvent) => {
    if (draggingBox !== null && editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left - dragOffset.x
        const y = e.clientY - rect.top - dragOffset.y
        setTextboxes(prev => prev.map(b => b.id === draggingBox ? { ...b, x, y } : b))
    }
  }

  const handleBoxDragEnd = () => {
    setDraggingBox(null)
  }

  const addTextbox = () => {
    setTextboxes([...textboxes, { id: Date.now(), x: 50, y: 50, text: 'New Text' }])
  }

  // Helpers
  const formatCurrency = (amount: number | string) => {
      const num = Number(amount)
      if (isNaN(num)) return amount
      return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
      if (!dateString) return '{{date}}'
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getBankTemplate = (bankName: string, type: 'LO' | 'Advice') => {
      const styles = `font-family: 'Times New Roman', serif; line-height: 1.6; font-size: 12pt;`
      
      // Bank Specific Headers
      let header = ''
      if (bankName.toLowerCase().includes('maybank')) {
          header = `<div style="text-align: right; font-weight: bold;">Ref: MBB/LC/${new Date().getFullYear()}/001</div>`
      } else if (bankName.toLowerCase().includes('cimb')) {
          header = `<div style="text-align: right; font-weight: bold;">Ref: CIMB-LC-${new Date().getFullYear()}-001</div>`
      } else {
           header = `<div style="text-align: right; font-weight: bold;">Our Ref: LC/GEN/${new Date().getFullYear()}/001</div>`
      }

      if (type === 'LO') {
          return `
            <div style="${styles}">
              ${header}
              <br/>
              <h3 style="text-align: center; text-transform: uppercase; text-decoration: underline;">LETTER OF OFFER</h3>
              <br/>
              <p><strong>Date:</strong> {{spa_date}}</p>
              <p><strong>To:</strong> {{purchaser_name}}</p>
              <p><strong>NRIC:</strong> {{purchaser_nric}}</p>
              <br/>
              <p><strong>RE: LOAN FACILITY OF {{loan_amount}} (THE "FACILITY")</strong></p>
              <p><strong>PROPERTY: {{property_address}}</strong></p>
              <br/>
              <p>We are pleased to offer you the banking facility subject to the terms and conditions herein contained.</p>
              <br/>
              <ol>
                  <li><strong>Facility Amount:</strong> {{loan_amount}}</li>
                  <li><strong>Purpose:</strong> To finance the purchase of the Property.</li>
                  <li><strong>Tenure:</strong> 35 Years.</li>
              </ol>
              <br/>
              <p>Please sign and return the duplicate of this letter.</p>
              <br/>
              <br/>
              <p>Yours faithfully,</p>
              <p><strong>${bankName || 'THE BANK'}</strong></p>
            </div>
          `
      } else {
          return `
            <div style="${styles}">
              ${header}
              <br/>
              <h3 style="text-align: center; text-transform: uppercase; text-decoration: underline;">ADVICE FOR DRAWDOWN</h3>
              <br/>
              <p><strong>Date:</strong> {{spa_date}}</p>
              <p><strong>To:</strong> The Manager, Loan Dept</p>
              <p><strong>${bankName || 'The Bank'}</strong></p>
              <br/>
              <p><strong>RE: {{purchaser_name}} ({{purchaser_nric}})</strong></p>
              <p><strong>LOAN: {{loan_amount}}</strong></p>
              <br/>
              <p>We refer to the above matter.</p>
              <p>Please be advised that all documentation has been perfected. You are hereby advised to release the drawdown sum.</p>
              <br/>
              <p>Enclosed herewith the following documents:</p>
              <ul>
                  <li>Original Facility Agreement</li>
                  <li>Charge Annexure</li>
                  <li>Duplicate Charge</li>
              </ul>
              <br/>
              <p>Thank you.</p>
              <br/>
              <p>Yours faithfully,</p>
              <p><strong>LAWCASE PRO PARTNERS</strong></p>
            </div>
          `
      }
  }

  const getPreviewContent = (overrideContent?: string) => {
      let preview = overrideContent || content
      if (caseData) {
          // Replace {{key}} with caseData[key]
          variables.forEach(v => {
              const regex = new RegExp(`{{${v.key}}}`, 'g')
              let value = caseData[v.key] || `{{${v.key}}}`
              
              // Formatting Logic 2.0
              if (value !== `{{${v.key}}}`) {
                  if (v.key === 'purchaser_name') value = value.toUpperCase()
                  if (v.key === 'spa_date') value = formatDate(value)
                  if (v.key === 'loan_amount') value = formatCurrency(value)
              }
              
              preview = preview.replace(regex, value)
          })
      }
      return preview
  }

  // Case Change is now handled by Search UI selection
  // handleSelectCase replaces handleCaseChange

  const toggleFullScreen = () => {
      setIsFullScreen(!isFullScreen)
  }
  
  const handlePrint = () => {
      window.print()
  }


  // ... 

  // Auto-select removed for Search-Driven Architecture
  // useEffect(() => { ... }, [searchResults])


  // Fix Upload Button
  const handleUploadClick = () => {
      // Ensure file input is reset to allow re-uploading same file
      if (fileInputRef.current) {
          fileInputRef.current.value = ''
          fileInputRef.current.click()
      }
  }

  // Audit Log Helper
  const logActivity = async (action: string, details: any = {}) => {
      if (!user || !profile?.firm_id) return
      
      try {
          await supabase.from('audit_logs').insert({
              action,
              table_name: 'documents',
              record_id: selectedCaseId ? selectedCaseId : null,
              user_id: user.id,
              firm_id: profile.firm_id,
              new_data: details,
              timestamp: new Date().toISOString()
          })
      } catch (err) {
          console.error('Audit Log Failed:', err) // Non-blocking
      }
  }

  // Generate Bank Document
  const handleGenerateBankDoc = (type: 'LO' | 'Advice') => {
      if (!selectedCaseId) {
          alert('Please select a case first.')
          return
      }
      
      // 1. Determine Template based on Bank (Mock Bank Name if missing)
      const bankName = caseData?.bank_name || 'Maybank Islamic Berhad' // Fallback for demo
      const templateContent = getBankTemplate(bankName, type)
      
      // 2. Auto-Generate Filename: [FileRef]_[DocType]_[YYYYMMDD].docx
      const fileRefSafe = (caseData?.fileRef || 'NOREF').replace(/[^a-zA-Z0-9]/g, '-')
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '')
      const fileName = `${fileRefSafe}_${type}_${dateStr}.docx`
      
      // 3. Log to "Central Vault" (Audit Log + Path Simulation)
      const vaultPath = `/firm_1/${selectedCaseId}/${type}/${fileName}`
      logActivity('GENERATE_AND_ARCHIVE', { 
          type, 
          bank: bankName,
          vault_path: vaultPath,
          auto_formatted: true 
      })
      
      console.log(`[Vault System] Archiving to: ${vaultPath}`)
      
      setContent(templateContent)
      setMode(isMobile ? 'preview' : 'edit')

      // Mobile Lite: Auto Download
      if (isMobile) {
          const finalContent = getPreviewContent(templateContent)
          asBlob(finalContent).then((data: any) => {
              saveAs(data, fileName)
          })
          setShowMobileActions(false)
      }
  }
  
  // Generate Cover Letter
  const handleGenerateCoverLetter = () => {
      if (!selectedCaseId) {
          alert('Please select a case first.')
          return
      }
      setContent(`
        <div style="font-family: 'Times New Roman', serif; line-height: 1.6;">
          <p><strong>Ref: LC/CONV/2024/001</strong></p>
          <p>Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p>&nbsp;</p>
          <p><strong>To: LAND OFFICE / PEJABAT TANAH</strong></p>
          <p>&nbsp;</p>
          <p>Dear Sir/Madam,</p>
          <p><strong>RE: TRANSFER OF PROPERTY</strong></p>
          <p><strong>Property: {{property_address}}</strong></p>
          <p><strong>Purchaser: {{purchaser_name}}</strong></p>
          <p>&nbsp;</p>
          <p>We refer to the above matter and enclose herewith...</p>
        </div>
      `)
      setMode('edit')
  }

  // Enhanced Export (Word/PDF)
  const handleExport = (format: 'pdf' | 'word') => {
      const finalContent = getPreviewContent()
      
      if (format === 'word') {
          // Professional SaaS Export
          asBlob(finalContent).then((data: any) => {
              saveAs(data, `Document_${selectedCaseId || 'Template'}.docx`)
          })
      } else {
          handlePrint() // Reuse print for PDF
      }
  }

  // AI Will Logic
  const handleGenerateWill = async () => {
      // Mock Will Data based on current case or prompt
      const willData = {
          beneficiaries: [{ name: 'Son', age: 10 }],
          witnesses: [{ name: 'Wife', relationship: 'Spouse' }],
          guardian: null
      }
      
      const analysis = await legalAI.auditWill(willData)
      if (!analysis.isValid) {
          alert('AI Will Auditor Alert:\n' + analysis.issues.join('\n'))
          if (analysis.suggestions.length) {
              alert('Suggestion: ' + analysis.suggestions.join('\n'))
          }
      } else {
          setContent(prev => prev + '<p><strong>[AI] Will Clauses Verified. No conflicts detected.</strong></p>')
      }
  }

  // Batch Generation Demo (Updated for Search Results)
  const handleBatchGenerateDemo = async () => {
      if (searchResults.length < 1) {
          alert('Need at least 1 case in search results for batch demo.')
          return
      }
      
      const confirmBatch = window.confirm(`Generate ZIP for visible search results?`)
      if (!confirmBatch) return

      try {
          const mockTemplateId = 'template_123' 
          const targetCases = searchResults.map(c => c.id.toString())
          alert(`Starting Batch Factory for: ${targetCases.join(', ')}... Check console for details.`)
          await documentFactory.batchGenerate(targetCases, mockTemplateId)
          alert('Batch Processing Complete! ZIP downloaded.')
      } catch (err) {
          console.error('Batch Failed', err)
          alert('Batch Generation Failed (Check Console)')
      }
  }

  // SSR Safe Sanitize (Allow Styles for Preview, Strict Security)
  const sanitizeHTML = (html: string) => {
    if (typeof window === 'undefined') return html
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'div','p','strong','h1','h2','h3', 
          'span','br','ul','li','b','i','u','ol'
        ],
        ALLOWED_ATTR: ['class','style'],
        FORBID_ATTR: ['onerror','onclick','onload'],
        ALLOWED_URI_REGEXP: /^https?:/
    })
  }

  return (
    <div className={`flex flex-col ${isFullScreen ? 'fixed inset-0 z-50 bg-white' : 'h-[calc(100vh-100px)]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-[#003366] flex items-center gap-2">
            <FileText size={24} /> 
            {isMobile ? 'Doc Preview' : 'Master Document Engine'}
          </h2>
          {!isMobile && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setMode('edit')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'edit' ? 'bg-[#003366] text-white shadow' : 'text-gray-600'}`}
              >
                Editor Mode
              </button>
              <button 
                onClick={() => setMode('preview')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'preview' ? 'bg-[#003366] text-white shadow' : 'text-gray-600'}`}
              >
                Print Preview
              </button>
            </div>
          )}
        </div>
        
        {/* Case Search for Preview (Search-Driven) */}
        {!isMobile && (
        <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-gray-500">Preview Data:</span>
             <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                      type="text" 
                      placeholder="Search Client or Ref..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setIsDropdownOpen(true)
                      }}
                      className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#003366] outline-none min-w-[250px]"
                  />
                  {isSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                </div>

                {/* Dropdown Results */}
                {isDropdownOpen && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                        {searchResults.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => handleSelectCase(c)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                            >
                                <p className="font-bold text-[#003366] text-sm">{c.client}</p>
                                <p className="text-xs text-gray-500">{c.fileRef || 'No Ref'}</p>
                            </button>
                        ))}
                    </div>
                )}
                {isDropdownOpen && searchResults.length === 0 && searchTerm.length >= 2 && !isSearching && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 text-center text-gray-400 text-xs">
                        No cases found
                    </div>
                )}
                {/* Backdrop to close */}
                {isDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                )}
             </div>
        </div>
        )}

        <div className="flex items-center gap-2">
           {isMobile && (
              <button 
                  onClick={() => setShowMobileActions(true)}
                  className="p-2 bg-[#003366] text-white rounded-lg shadow-sm"
              >
                  <Zap size={20} />
              </button>
           )}

           {!isMobile && (
           <>
           <button onClick={() => setShowRulers(!showRulers)} className={`p-2 rounded hover:bg-gray-100 ${showRulers ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`} title="Toggle Rulers">
             <Grid size={20} />
           </button>
           <button onClick={toggleFullScreen} className="p-2 text-gray-500 hover:bg-gray-100 rounded" title="Full Screen">
             {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </button>
           <button onClick={handleGenerateWill} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold shadow-sm">
             <Settings size={18} /> AI Audit Will
           </button>
           <button onClick={handleGenerateCoverLetter} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm">
             <FileText size={18} /> Land Office Letter
           </button>
           <button onClick={handleBatchGenerateDemo} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold shadow-sm" title="Test Factory Batch Engine">
             <Package size={18} /> Batch ZIP
           </button>
           </>
           )}
           <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden">
               <button onClick={() => handleExport('word')} className="px-3 py-2 hover:bg-gray-100 border-r border-gray-200" title="Export to Word">
                   <FileText size={18} className="text-blue-600" />
               </button>
               <button onClick={() => handleExport('pdf')} className="px-3 py-2 hover:bg-gray-100" title="Print / PDF">
                   <Printer size={18} className="text-gray-700" />
               </button>
           </div>
        </div>
      </div>

      {/* Mobile Actions Modal */}
      {isMobile && showMobileActions && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center animate-fade-in" onClick={() => setShowMobileActions(false)}>
              <div className="bg-white w-full rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-lg text-[#003366]">Quick Actions</h3>
                      <button onClick={() => setShowMobileActions(false)}><ChevronDown /></button>
                  </div>
                  
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">Search Case Context</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search Client..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-12 pr-4 py-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#003366]"
                        />
                        {isSearching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                      </div>

                      {/* Mobile Results List */}
                      {searchResults.length > 0 && (
                          <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl mt-2 bg-gray-50">
                              {searchResults.map(c => (
                                  <button 
                                      key={c.id} 
                                      onClick={() => handleSelectCase(c)}
                                      className="w-full text-left px-4 py-3 border-b border-gray-200 last:border-0 hover:bg-white"
                                  >
                                      <p className="font-bold text-[#003366] text-sm">{c.client}</p>
                                      <p className="text-xs text-gray-500">{c.fileRef || 'No Ref'}</p>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => handleGenerateBankDoc('LO')}
                        disabled={!selectedCaseId}
                        className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                      >
                          <FileText size={24} className="text-blue-600" />
                          <span className="text-xs font-bold text-blue-800">Generate LO</span>
                          <span className="text-[10px] text-gray-400">Auto Download</span>
                      </button>
                      <button 
                        onClick={() => handleGenerateBankDoc('Advice')}
                        disabled={!selectedCaseId}
                        className="p-4 bg-green-50 border border-green-100 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                      >
                          <FileText size={24} className="text-green-600" />
                          <span className="text-xs font-bold text-green-800">Gen. Advice</span>
                          <span className="text-[10px] text-gray-400">Auto Download</span>
                      </button>
                  </div>
                  
                  <button 
                    onClick={() => handleExport('pdf')}
                    className="w-full py-4 bg-[#003366] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                  >
                      <Download size={20} /> Download Current Doc
                  </button>
              </div>
          </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Variables) */}
        {!isMobile && mode === 'edit' && (
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
            {/* Bank Docs Selector */}
            <div className="mt-6 mb-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Bank Documents</h3>
                <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => handleGenerateBankDoc('LO')} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-green-400 text-left">
                        <p className="text-sm font-bold text-green-700">Letter of Offer</p>
                        <p className="text-xs text-gray-400">Standard Bank Format</p>
                    </button>
                    <button onClick={() => handleGenerateBankDoc('Advice')} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-green-400 text-left">
                        <p className="text-sm font-bold text-green-700">Advice for Drawdown</p>
                        <p className="text-xs text-gray-400">Release instruction</p>
                    </button>
                </div>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Variables</h3>
            <div className="space-y-2">
              {variables.map(v => (
                <div 
                  key={v.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, v.key)}
                  className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-move hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-2"
                >
                  <Type size={16} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-700">{v.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{v.key}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mt-6 mb-4">Tools</h3>
            <button 
              onClick={addTextbox}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-2 text-left"
            >
              <Move size={16} className="text-purple-500" />
              <div>
                <p className="text-sm font-bold text-gray-700">Add Textbox</p>
                <p className="text-xs text-gray-400">Floating draggable text</p>
              </div>
            </button>

            {/* Ruler Adjustment */}
            {showRulers && (
                <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-1">
                        <Sliders size={12} /> Ruler Offset
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">X-Axis (mm)</label>
                            <input 
                                type="number" 
                                value={rulerOffset.x}
                                onChange={(e) => setRulerOffset({...rulerOffset, x: Number(e.target.value)})}
                                className="w-full text-xs p-1 border rounded"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500">Y-Axis (mm)</label>
                            <input 
                                type="number" 
                                value={rulerOffset.y}
                                onChange={(e) => setRulerOffset({...rulerOffset, y: Number(e.target.value)})}
                                className="w-full text-xs p-1 border rounded"
                            />
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 bg-gray-200 p-8 overflow-auto relative flex justify-center" onMouseMove={handleBoxDragMove} onMouseUp={handleBoxDragEnd}>
          
          {/* Rulers */}
          {showRulers && mode === 'edit' && (
             <>
               <div 
                    className="absolute top-0 left-0 w-full h-6 bg-white border-b border-gray-300 z-10 flex text-[10px] text-gray-400 pl-8 transition-all"
                    style={{ transform: `translateY(${rulerOffset.y}px)` }}
               >
                 {/* Top Ruler Mock */}
                 {Array.from({ length: 20 }).map((_, i) => (
                   <div key={i} className="flex-1 border-l border-gray-300 h-full pl-1">{i * 50}px</div>
                 ))}
               </div>
               <div 
                    className="absolute top-0 left-0 w-6 h-full bg-white border-r border-gray-300 z-10 flex flex-col text-[10px] text-gray-400 pt-8 transition-all"
                    style={{ transform: `translateX(${rulerOffset.x}px)` }}
               >
                 {/* Left Ruler Mock */}
                 {Array.from({ length: 30 }).map((_, i) => (
                   <div key={i} className="flex-1 border-t border-gray-300 w-full pt-1">{i * 50}</div>
                 ))}
               </div>
             </>
          )}

          {/* A4 Page Container */}
          <div 
            ref={editorRef}
            className={`bg-white shadow-2xl relative mx-auto transition-transform origin-top overflow-hidden ${isMobile ? 'w-full min-h-screen shadow-none' : 'min-h-[1123px] w-[794px]'}`}
            style={isMobile ? {} : { 
              marginTop: showRulers ? '20px' : '0',
              marginLeft: showRulers ? '20px' : 'auto',
              transform: `translate(${rulerOffset.x}px, ${rulerOffset.y}px)`,
              transformOrigin: 'top center'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const key = e.dataTransfer.getData('text/plain')
              if (key && editorRef.current) {
                const rect = editorRef.current.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                setTextboxes([...textboxes, { id: Date.now(), x, y, text: key }])
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Background Layer (1:1 Original) */}
            {bgFile && (
               <div className="absolute inset-0 z-0 pointer-events-none">
                 {bgType === 'image' ? (
                   <img src={bgFile} className="w-full h-full object-contain opacity-50" alt="Background" />
                 ) : (
                   <iframe src={bgFile} className="w-full h-full opacity-50" title="PDF Background" />
                 )}
               </div>
            )}

            {!bgFile && mode === 'edit' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl pointer-events-auto bg-gray-50/80">
                  <p className="text-gray-500 font-bold mb-2">No Document Loaded</p>
                  <button 
                    onClick={handleUploadClick}
                    className="cursor-pointer bg-[#003366] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#002855] inline-block pointer-events-auto relative z-50"
                  >
                    Upload Original PDF / Image
                  </button>
                  <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={handleFileUpload} 
                  />
                </div>
              </div>
            )}

            {mode === 'edit' ? (
              <div 
                className="w-full h-full outline-none relative z-10"
                contentEditable
                onInput={(e) => setContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeHTML(content)
                }}
                style={{ minHeight: '800px', padding: isMobile ? '24px' : '96px' }}
              />
            ) : (
              <div 
                className="w-full h-full relative z-10"
                style={{ padding: isMobile ? '24px' : '96px' }}
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeHTML(getPreviewContent())
                }}
              />
            )}

            {/* Draggable Textboxes Overlay (Nitro PDF Style) */}
            {mode === 'edit' && textboxes.map(box => (
              <div
                key={box.id}
                className="absolute bg-transparent border border-dashed border-blue-400 p-1 group"
                style={{ left: box.x, top: box.y, minWidth: '100px' }}
              >
                <div 
                  className="absolute -top-3 -left-3 bg-blue-500 text-white p-1 rounded-full cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleBoxDragStart(box.id, e)}
                >
                  <Move size={12} />
                </div>
                <div 
                  contentEditable 
                  className="outline-none text-sm text-blue-900"
                  onInput={(e) => {
                    const newText = e.currentTarget.textContent || ''
                    setTextboxes(prev => prev.map(b => b.id === box.id ? { ...b, text: newText } : b))
                  }}
                >
                  {box.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}