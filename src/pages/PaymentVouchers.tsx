
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Printer, FileText, DollarSign, CheckCircle, X, Shield, Clock, UserCheck, ArrowRight, AlertTriangle, Edit, Settings, Trash2, Link as LinkIcon } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'
import SecurityModal from '../components/SecurityModal'
import { useRole } from '../context/RoleContext'
import { numberToWords } from '../utils/numberToWords'
import { checkStatutory } from '../data/statutoryRules'
import { financeService } from '../services/financeService'
import { legalAI } from '../modules/ai/legal_ai.service'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useFirmCases } from '../hooks/useFirmCases'

type PaymentVoucher = {
  id: string
  pv_no: string
  date: string
  payee_name: string
  type: 'Cash' | 'Cheque' | 'Online Transfer'
  amount: number
  category: 'Office' | 'Client' | 'Utility' | 'Other' | null
  status: 'Draft' | 'Submitted' | 'Categorized' | 'Approved' | 'Paid' | 'File Returned'
  created_by: string
  purpose: string
  remarks?: string
  payment_status?: 'advance' | 'client_paid'
  submitted_at?: string
  categorized_at?: string
  approved_at?: string
  paid_at?: string
  file_returned_at?: string
  approved_by?: string
  categorized_by?: string
  paid_by?: string
  template_id?: string
  // Linked Cases (Joined)
  payment_voucher_cases?: {
      case: {
          id: number
          client: string
          fileRef: string
          project: string
      }
  }[]
}

export default function PaymentVouchers({ embedded = false }: { embedded?: boolean }) {
  const { actualRole } = useRole()
  const { session } = useAuth()
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPV, setSelectedPV] = useState<PaymentVoucher | null>(null)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [printData, setPrintData] = useState<PaymentVoucher | null>(null)
  const [printContent, setPrintContent] = useState<string | null>(null)
  const [statutoryRule, setStatutoryRule] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  // Payee History for Autocomplete
  const [payeeHistory, setPayeeHistory] = useState<string[]>([])

  // Case Search (New Logic)
  const [caseSearchTerm, setCaseSearchTerm] = useState('')
  const [caseResults, setCaseResults] = useState<any[]>([])
  const [selectedCases, setSelectedCases] = useState<any[]>([])

  useEffect(() => {
    if (!caseSearchTerm || caseSearchTerm.length < 2) {
        setCaseResults([])
        return
    }

    const timer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/cases/search?q=${caseSearchTerm}`)
            if (res.ok) {
                const data = await res.json()
                setCaseResults(data)
            }
        } catch (e) {
            console.error("Search failed", e)
        }
    }, 300)

    return () => clearTimeout(timer)
  }, [caseSearchTerm])

  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Form State
  const [formData, setFormData] = useState<Partial<PaymentVoucher>>({
    payee_name: '',
    type: 'Online Transfer',
    amount: 0,
    purpose: '',
    template_id: '',
    remarks: '',
    payment_status: 'advance'
  })
  
  // Categorization State
  const [categoryInput, setCategoryInput] = useState<string>('Office')

  // Load Data
  useEffect(() => {
    fetchVouchers()
    fetchTemplates()
  }, [actualRole])

  // Debounce Case Search Removed (Integrated above)

  const fetchTemplates = async () => {
    if (!session?.access_token) return
    try {
        const res = await fetch('/api/pv-templates/list', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
        const { data } = await res.json()
        if (data) setTemplates(data)
    } catch (e) {
        console.error('Error fetching templates:', e)
    }
  }

  const fetchVouchers = async () => {
      if (!session?.access_token) return
      setLoading(true)
      try {
          const res = await fetch('/api/pv/list', {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
          })
          const { data } = await res.json()
          
          // @ts-ignore
          setVouchers(data || [])
          // Extract unique payees
          // @ts-ignore
          const payees = Array.from(new Set(data?.map((v: PaymentVoucher) => v.payee_name))) as string[]
          setPayeeHistory(payees)
      } catch (error) {
          console.error('Error fetching PVs:', error)
      }
      setLoading(false)
  }
  
  // Purpose Auto-Sum & AI Audit Logic
  useEffect(() => {
    if (formData.purpose) {
      // 1. AI Auditor (Async)
      const audit = async () => {
          // Pass 'Office' as default category for audit if null
          const result = await legalAI.auditPV(formData.purpose || '', 'Office', formData.amount || 0)
          if (result.issues.length > 0) {
              setStatutoryRule({ 
                  paymentType: 'AI Audit Alert',
                  epf: false, socso: false, eis: false, hrdf: false,
                  note: result.issues.join(' | ') + (result.suggestions.length ? ' Suggestion: ' + result.suggestions[0] : '')
              })
          }
      }
      audit()

      // 2. Regex Auto-Sum
      const regex = /RM\s?(\d{1,3}(,\d{3})*(\.\d{2})?)/gi
      let total = 0
      let match
      while ((match = regex.exec(formData.purpose)) !== null) {
        const val = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(val)) total += val
      }
      
      if (total > 0) {
           setFormData(prev => ({ ...prev, amount: total }))
      }
    }
  }, [formData.purpose])

  // Helper to render statutory warning
  const getStatutoryWarning = () => {
      if (!formData.purpose) return null
      const rule = checkStatutory(formData.purpose)
      if (rule) {
          return (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-start gap-2">
                  <Shield size={14} className="mt-0.5" />
                  <div>
                      <strong>Statutory Rule Detected ({rule.paymentType}):</strong>
                      <div className="grid grid-cols-4 gap-2 mt-1">
                          <span className={rule.epf ? 'text-green-700 font-bold' : 'text-red-600'}>EPF: {rule.epf ? 'YES' : 'NO'}</span>
                          <span className={rule.socso ? 'text-green-700 font-bold' : 'text-red-600'}>SOCSO: {rule.socso ? 'YES' : 'NO'}</span>
                          <span className={rule.eis ? 'text-green-700 font-bold' : 'text-red-600'}>EIS: {rule.eis ? 'YES' : 'NO'}</span>
                          <span className={rule.hrdf ? 'text-green-700 font-bold' : 'text-red-600'}>HRDF: {rule.hrdf ? 'YES' : 'NO'}</span>
                      </div>
                      {rule.note && <p className="mt-1 italic text-yellow-700">Note: {rule.note}</p>}
                  </div>
              </div>
          )
      }
      return null
  }

  const handleSave = async () => {
    if (!formData.payee_name || !formData.amount) return alert('Please fill in required fields')

    const token = session?.access_token
    if (!token) return alert('User not authenticated')

    try {
        const response = await fetch('/api/pv/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                payee_name: formData.payee_name,
                type: formData.type,
                amount: Number(formData.amount),
                purpose: formData.purpose || '',
                remarks: formData.remarks || '',
                payment_status: formData.payment_status || 'advance',
                cases: selectedCases.map(c => c.id),
                // bank_account: formData.bank_account, // Add to form later
                // reference: formData.reference, // Add to form later
            })
        })

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create PV');
        }
        
        const result = await response.json();
        const newPVId = result.pv_id;
        
        // Link Template (Call Update API)
        if (selectedTemplateId) {
            await fetch('/api/pv/update', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: newPVId, template_id: selectedTemplateId })
            });
        }

        fetchVouchers()
        setShowModal(false)
        setFormData({ 
            payee_name: '', 
            type: 'Online Transfer', 
            amount: 0, 
            purpose: '', 
            template_id: '',
            remarks: '',
            payment_status: 'advance'
        })
        setSelectedCases([])
        setSelectedTemplateId('')
        alert('Draft Created Successfully')
    } catch (e: any) {
        alert('Failed to create PV: ' + e.message)
    }
  }

  // Workflow Actions
  const updateStatus = async (id: string, newStatus: string, updates: any = {}) => {
      const token = session?.access_token
      if (!token || !session?.user) return

      try {
          if (newStatus === 'Categorized') {
             // API Call
             const res = await fetch('/api/pv/assign-category', {
                 method: 'POST',
                 headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                 },
                 body: JSON.stringify({ pvId: id, category: updates.category, userId: session.user.id })
             })
             if (!res.ok) throw new Error((await res.json()).error)
          } 
          else if (newStatus === 'Approved') {
              const res = await fetch('/api/pv/approve', {
                 method: 'POST',
                 headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                 },
                 body: JSON.stringify({ pvId: id, userId: session.user.id })
             })
             if (!res.ok) throw new Error((await res.json()).error)
          }
          else if (newStatus === 'Paid') {
              const res = await fetch('/api/pv/mark-paid', {
                 method: 'POST',
                 headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                 },
                 body: JSON.stringify({ pvId: id, userId: session.user.id })
             })
             if (!res.ok) throw new Error((await res.json()).error)
          }
          else {
              // General Update via API
              const res = await fetch('/api/pv/update', {
                  method: 'PUT',
                  headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ id, status: newStatus, ...updates })
              })
              if (!res.ok) throw new Error((await res.json()).error)
          }
          
          fetchVouchers()
          setShowDetailModal(false)
          alert(`Success: Status updated to ${newStatus}`)
      } catch (e: any) {
          alert('Action Failed: ' + e.message)
      }
  }

  const handleSubmit = (id: string) => {
      if (confirm('Submit this PV for categorization?')) {
          updateStatus(id, 'Submitted', { submitted_at: new Date().toISOString() })
      }
  }

  const handleCategorize = (id: string) => {
      if (!categoryInput) return alert('Please select a category')
      if (confirm(`Assign category '${categoryInput}' and submit for approval?`)) {
          updateStatus(id, 'Categorized', { 
              category: categoryInput,
              categorized_at: new Date().toISOString(),
              categorized_by: actualRole // In real app, use auth.uid()
          })
      }
  }

  const handleApprove = (id: string) => {
    if (confirm('Approve this Payment Voucher?')) {
        updateStatus(id, 'Approved', { 
            approved_at: new Date().toISOString(),
            approved_by: actualRole
        })
    }
  }

  const handleMarkAsPaid = (id: string) => {
    if (confirm('Confirm payment released?')) {
        updateStatus(id, 'Paid')
    }
  }

  const handlePrintPV = async (pv: PaymentVoucher) => {
      if (pv.template_id && session?.access_token) {
          // 1. Fetch Template
          try {
              const res = await fetch(`/api/pv-templates/get?id=${pv.template_id}`, {
                  headers: { 'Authorization': `Bearer ${session.access_token}` }
              })
              const { data: tmpl } = await res.json()
          
              if (tmpl && tmpl.html_content) {
              let content = tmpl.html_content
              
              // 2. Prepare Variables
              const caseList = pv.payment_voucher_cases?.map(link => 
                  `<li><strong>${link.case.fileRef}</strong> - ${link.case.client} (${link.case.project})</li>`
              ).join('') || '<li>No linked cases</li>'
              
              const variables: any = {
                  payee_name: pv.payee_name,
                  amount: pv.amount.toFixed(2),
                  amount_words: numberToWords(pv.amount),
                  purpose: pv.purpose,
                  remarks: pv.remarks || '',
                  payment_status: pv.payment_status === 'client_paid' ? 'CLIENT PAID' : 'ADVANCE (Firm Paid)',
                  date: pv.date,
                  pv_no: pv.pv_no,
                  created_by: pv.created_by, // Ideally fetch name
                  payment_type: pv.type,
                  category: pv.category || 'Uncategorized',
                  case_refs: `<ul>${caseList}</ul>`
              }

              // 3. Inject
              Object.keys(variables).forEach(key => {
                  const regex = new RegExp(`{{${key}}}`, 'g')
                  content = content.replace(regex, variables[key])
              })
              
              setPrintContent(content)
              setPrintData(null)
          } else {
              // Fallback if template missing
              setPrintData(pv)
              setPrintContent(null)
          }
        } catch (e) {
            console.error(e)
            setPrintData(pv)
        }
      } else {
          // Default System Template
          setPrintData(pv)
          setPrintContent(null)
      }
      
      setTimeout(() => window.print(), 300)
  }

  // Filter
  const filtered = vouchers.filter(v => 
    v.payee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.pv_no.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openDetail = (pv: PaymentVoucher) => {
      setSelectedPV(pv)
      setCategoryInput(pv.category || 'Office')
      setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Screen View */}
      <div className="print:hidden space-y-6">
        {!embedded && (
            <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Payment Vouchers</h2>
                <p className="text-gray-500 text-sm mt-1">Manage expenses and print vouchers for approval.</p>
            </div>
            <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
            >
                <Plus size={18} /> New PV
            </button>
            </div>
            <Breadcrumbs />
            </>
        )}
        
        {embedded && (
             <div className="flex justify-end">
                <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
                >
                    <Plus size={18} /> New PV
                </button>
             </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <Search className="text-gray-400" size={20} />
          <input 
            className="flex-1 outline-none text-gray-700"
            placeholder="Search Payee or PV No..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold text-sm uppercase border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">PV No</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Payee</th>
                <th className="px-6 py-4">Recovery</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Amount (RM)</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(pv => (
                <tr key={pv.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => openDetail(pv)}>
                  <td className="px-6 py-4 font-mono text-[#003366] font-bold">{pv.pv_no}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{pv.date}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">
                      {pv.payee_name}
                      {pv.purpose && <p className="text-xs text-gray-500 truncate max-w-[200px]">{pv.purpose}</p>}
                      {pv.remarks && <p className="text-xs text-orange-600 truncate max-w-[200px] font-bold">Note: {pv.remarks}</p>}
                  </td>
                  <td className="px-6 py-4">
                      {pv.payment_status === 'client_paid' ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">CLIENT PAID</span>
                      ) : (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold uppercase">ADVANCE</span>
                      )}
                  </td>
                  <td className="px-6 py-4">
                    {pv.category ? (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">{pv.category}</span>
                    ) : (
                        <span className="text-gray-400 text-xs italic">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-800">{pv.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      pv.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                      pv.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                      pv.status === 'Categorized' ? 'bg-purple-100 text-purple-700' :
                      pv.status === 'Submitted' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {pv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-[#003366] font-bold text-xs hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New PV Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                <FileText size={20} /> New Payment Voucher
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               {/* 1. Case Selection */}
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Link Cases (Optional)</label>
                  <div className="relative">
                     <input 
                       className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                       placeholder="Search case to link..."
                       value={caseSearchTerm}
                       onChange={e => setCaseSearchTerm(e.target.value)}
                     />
                     <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                     
                     {/* Search Results Dropdown */}
                     {caseResults.length > 0 && caseSearchTerm.length >= 2 && (
                         <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-xl rounded-lg mt-1 z-50 max-h-40 overflow-y-auto">
                             {caseResults.map(c => (
                                 <button 
                                     key={c.id}
                                     onClick={() => {
                                         if (!selectedCases.find(sc => sc.id === c.id)) {
                                             setSelectedCases([...selectedCases, c])
                                         }
                                         setCaseSearchTerm('')
                                     }}
                                     className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 text-sm"
                                 >
                                     <div className="font-bold text-[#003366]">{c.client}</div>
                                     <div className="text-xs text-gray-500">{c.fileRef} - {c.project}</div>
                                 </button>
                             ))}
                         </div>
                     )}
                  </div>
                  
                  {/* Selected Cases Chips */}
                  {selectedCases.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                          {selectedCases.map(c => (
                              <div key={c.id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-blue-100">
                                  {c.client} ({c.fileRef})
                                  <button onClick={() => setSelectedCases(selectedCases.filter(sc => sc.id !== c.id))} className="hover:text-red-500"><X size={12} /></button>
                              </div>
                          ))}
                      </div>
                  )}
               </div>

               {/* 2. Template Selection */}
               <div>
                   <div className="flex justify-between items-center mb-1">
                       <label className="block text-sm font-bold text-gray-700">Print Template</label>
                       <Link to="/pv-designer" className="text-xs font-bold text-[#003366] flex items-center gap-1 hover:underline">
                           <Settings size={12} /> Designer
                       </Link>
                   </div>
                   <select 
                       className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                       value={selectedTemplateId}
                       onChange={e => setSelectedTemplateId(e.target.value)}
                   >
                       <option value="">Default System Template (A5)</option>
                       {templates.map(t => (
                           <option key={t.id} value={t.id}>{t.name}</option>
                       ))}
                   </select>
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Payee Name <span className="text-red-500">*</span></label>
                  <input 
                    list="payee-list"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none" 
                    value={formData.payee_name} 
                    onChange={e => setFormData({...formData, payee_name: e.target.value})} 
                    placeholder="Start typing for suggestion..."
                  />
                  <datalist id="payee-list">
                      {payeeHistory.map(name => <option key={name} value={name} />)}
                  </datalist>
               </div>
               
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Purpose / Description</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none h-24 resize-none" 
                    value={formData.purpose} 
                    onChange={e => setFormData({...formData, purpose: e.target.value})} 
                    placeholder="e.g. Stamp Duty (RM 1,500.00) and Filing Fee (RM 300.00)"
                  />
                  <p className="text-xs text-blue-600 mt-1 font-bold">✨ Smart Entry: System auto-detects 'RM' values and sums them up.</p>
                  {getStatutoryWarning()}
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Remarks</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none h-20 resize-none" 
                    value={formData.remarks || ''} 
                    onChange={e => setFormData({...formData, remarks: e.target.value})} 
                    placeholder="e.g. Urgent, Due 30/3, Waiting client payment"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Payment Status (Recovery Type)</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                    value={formData.payment_status || 'advance'}
                    onChange={e => setFormData({...formData, payment_status: e.target.value as any})}
                  >
                    <option value="advance">Advance (Firm Paid)</option>
                    <option value="client_paid">Client Paid</option>
                  </select>
               </div>
               
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Payment Type</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="Online Transfer">Online Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Amount (RM) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">RM</span>
                    <input 
                        type="number"
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none font-mono font-bold text-lg" 
                        value={formData.amount} 
                        onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
                    />
                  </div>
                  {formData.amount! > 0 && (
                      <p className="text-xs text-gray-500 mt-1 italic uppercase">{numberToWords(formData.amount!)}</p>
                  )}
               </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-8 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                <CheckCircle size={18} /> Create Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Action Modal */}
      {showDetailModal && selectedPV && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0">
                    <div>
                        <h3 className="text-xl font-bold text-[#003366]">{selectedPV.pv_no}</h3>
                        <p className="text-xs text-gray-500">Status: <span className="font-bold uppercase">{selectedPV.status}</span></p>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Info Block */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Payee</p>
                            <p className="text-lg font-bold">{selectedPV.payee_name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 font-bold uppercase">Amount</p>
                            <p className="text-lg font-bold text-[#003366]">RM {selectedPV.amount.toFixed(2)}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-gray-500 font-bold uppercase">Purpose</p>
                            <p className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mt-1">{selectedPV.purpose}</p>
                        </div>
                    </div>

                    {/* Workflow Actions Section */}
                    <div className="border-t border-gray-200 pt-6">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Shield size={16} /> Workflow Actions</h4>
                        
                        {/* 1. Submit (Staff) */}
                        {selectedPV.status === 'Draft' && (
                            <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                                <p className="text-sm text-blue-800">Review details and submit for categorization.</p>
                                <button onClick={() => handleSubmit(selectedPV.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Submit</button>
                            </div>
                        )}

                        {/* 2. Categorize (Account) */}
                        {selectedPV.status === 'Submitted' && (actualRole === 'Account' || actualRole === 'Founder') && (
                            <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                                <p className="text-sm text-orange-800 font-bold">Action Required: Assign Category</p>
                                <select 
                                    className="w-full border border-orange-300 rounded-lg px-4 py-2"
                                    value={categoryInput}
                                    onChange={e => setCategoryInput(e.target.value)}
                                >
                                    <option value="Office">Office Expense</option>
                                    <option value="Client">Client Disbursement</option>
                                    <option value="Utility">Utility</option>
                                    <option value="Other">Other</option>
                                </select>
                                <button onClick={() => handleCategorize(selectedPV.id)} className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700">Confirm Category & Submit</button>
                            </div>
                        )}

                        {/* 3. Approve (Partner) */}
                        {selectedPV.status === 'Categorized' && (actualRole === 'Partner' || actualRole === 'Founder') && (
                            <div className="bg-purple-50 p-4 rounded-lg flex flex-col gap-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-purple-800">Category Assigned: <strong>{selectedPV.category}</strong></span>
                                    <span className="text-sm text-purple-800">Amount: <strong>RM {selectedPV.amount.toFixed(2)}</strong></span>
                                </div>
                                <button onClick={() => handleApprove(selectedPV.id)} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 flex items-center justify-center gap-2">
                                    <CheckCircle size={16} /> Approve Payment
                                </button>
                            </div>
                        )}

                        {/* 4. Pay (Account) */}
                        {selectedPV.status === 'Approved' && (actualRole === 'Account' || actualRole === 'Founder') && (
                            <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                                <p className="text-sm text-green-800">Payment approved. Ready to release funds.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => handlePrintPV(selectedPV)} className="px-3 py-2 border border-green-600 text-green-700 rounded-lg font-bold hover:bg-green-100 flex items-center gap-1">
                                        <Printer size={16} /> Print
                                    </button>
                                    <button onClick={() => handleMarkAsPaid(selectedPV.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-1">
                                        <DollarSign size={16} /> Mark Paid
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* View Only / Completed */}
                        {(selectedPV.status === 'Paid' || (selectedPV.status === 'Approved' && (actualRole === 'Account' || actualRole === 'Senior Clerk' || actualRole === 'Junior Clerk'))) && (
                             <div className="text-center py-4 text-gray-500">
                                 <p className="italic">Current Status: {selectedPV.status}</p>
                                 {selectedPV.status === 'Paid' && <p className="text-xs">Paid on: {new Date(selectedPV.paid_at!).toLocaleDateString()}</p>}
                                 <button onClick={() => handlePrintPV(selectedPV)} className="mt-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                                     <Printer size={16} className="inline mr-2" /> Print Copy
                                 </button>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* A5 Print Layout (Visible only on Print) */}
      <div id="print-section" className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
        {printContent ? (
            <div dangerouslySetInnerHTML={{ __html: printContent }} />
        ) : (
            printData && (
           <div className="w-[148mm] h-[210mm] mx-auto border-2 border-gray-800 p-8 relative flex flex-col justify-between">
             {/* Header & Content */}
             <div>
                <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                    <div className="flex items-center gap-4">
                         <div className="bg-[#003366] text-white p-2 rounded font-bold text-2xl print:bg-black print:text-white">LC</div>
                         <div>
                             <h1 className="text-2xl font-bold uppercase tracking-wide">LawCase Pro</h1>
                             <p className="text-xs text-gray-600">Legal Firm & Associates</p>
                         </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold uppercase">Payment Voucher</h2>
                        <p className="font-mono text-lg">{printData.pv_no}</p>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                        <span className="font-bold text-gray-600 uppercase text-xs">Date:</span>
                        <span className="font-mono text-sm">{printData.date}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                        <span className="font-bold text-gray-600 uppercase text-xs">Payee To:</span>
                        <span className="font-bold text-lg">{printData.payee_name}</span>
                    </div>

                    <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                        <span className="font-bold text-gray-600 uppercase text-xs">Payment Status:</span>
                        <span className="font-bold text-lg">{printData.payment_status === 'client_paid' ? 'CLIENT PAID' : 'ADVANCE (Firm Paid)'}</span>
                    </div>
                    
                    <div className="border border-gray-300 p-2 min-h-[60px] text-sm">
                        <span className="font-bold text-gray-600 uppercase text-xs block mb-1">Purpose:</span>
                        <pre className="font-sans whitespace-pre-wrap">{printData.purpose}</pre>
                    </div>

                    {printData.remarks && (
                        <div className="border border-gray-300 p-2 text-sm mt-2 bg-gray-50">
                            <span className="font-bold text-gray-600 uppercase text-xs block mb-1">Remarks:</span>
                            <pre className="font-sans whitespace-pre-wrap">{printData.remarks}</pre>
                        </div>
                    )}
                    
                    {/* Linked Cases Summary */}
                    {printData.payment_voucher_cases && printData.payment_voucher_cases.length > 0 && (
                        <div className="border border-gray-300 p-2 text-xs bg-gray-50 print:bg-gray-100">
                            <span className="font-bold text-gray-600 uppercase block mb-1">Linked Cases ({printData.payment_voucher_cases.length}):</span>
                            <ul className="list-disc list-inside">
                                {printData.payment_voucher_cases.map(link => (
                                    <li key={link.case.id} className="truncate">
                                        <strong>{link.case.fileRef}</strong> - {link.case.client}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                            <span className="font-bold text-gray-600 uppercase text-xs">Category:</span>
                            <span className="text-sm">{printData.category}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                            <span className="font-bold text-gray-600 uppercase text-xs">Type:</span>
                            <span className="text-sm">{printData.type}</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-300 print:bg-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-lg uppercase">Total:</span>
                            <span className="font-bold text-2xl">RM {printData.amount.toFixed(2)}</span>
                        </div>
                        <p className="text-xs font-bold uppercase border-t border-gray-300 pt-2 text-gray-600">
                            {numberToWords(printData.amount)}
                        </p>
                    </div>
                </div>
             </div>

             {/* 6-Level Signature Block */}
             <div className="mt-auto pt-4 grid grid-cols-2 gap-x-6 gap-y-6 text-[10px]">
                 {/* Row 1 */}
                 <div className="border-t border-gray-400 pt-1">
                     <p className="font-bold uppercase mb-4">Prepared by:</p>
                     <p className="font-mono text-sm">{printData.created_by || 'Staff'}</p>
                 </div>
                 <div className="border-t border-gray-400 pt-1">
                     <p className="font-bold uppercase mb-4">Partner Approved by:</p>
                     <p className="font-mono text-sm mb-4">{printData.approved_by || '________________'}</p>
                     <div className="border-b border-dashed border-gray-400 w-full mb-1"></div>
                     <p className="text-[8px] text-gray-400">Signature</p>
                 </div>

                 {/* Row 2 */}
                 <div className="border-t border-gray-400 pt-1">
                     <p className="font-bold uppercase mb-4">Categorized by (Account):</p>
                     <p className="font-mono text-sm mb-4">{printData.categorized_by || '________________'}</p>
                     <div className="border-b border-dashed border-gray-400 w-full mb-1"></div>
                 </div>
                 <div className="border-t border-gray-400 pt-1">
                     <p className="font-bold uppercase mb-4">Payment Released by:</p>
                     <p className="font-mono text-sm mb-4">{printData.paid_by || '________________'}</p>
                     <div className="border-b border-dashed border-gray-400 w-full mb-1"></div>
                 </div>
             </div>
             
             {/* Print Footer */}
             <div className="text-center text-[8px] text-gray-400 mt-2">
                 Generated by LawCase Pro System on {new Date().toLocaleString()}
             </div>
           </div>
           )
        )}
      </div>
      
      {/* Print CSS Injection */}
      <style>{`
        @media print {
          @page { size: A5; margin: 0; }
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: white; }
        }
      `}</style>
    </div>
  )
}
