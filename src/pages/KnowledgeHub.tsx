
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, BookOpen, CheckCircle, X, Shield, AlertTriangle } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'
import SecurityModal from '../components/SecurityModal'
import { useRole } from '../context/RoleContext'
import { statutoryRules, StatutoryRule } from '../data/statutoryRules'

type Article = {
  id: number
  ref_no: string
  date: string
  title: string
  category: 'SOP' | 'Legal Precedent' | 'Client Guide' | 'System Manual' | 'HR Policy' | 'Other'
  status: 'Draft' | 'Published' | 'Archived'
  created_by: string
  content: string
}

export default function KnowledgeHub() {
  const { actualRole } = useRole()
  const [articles, setArticles] = useState<Article[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  
  // Interactive Query State
  const [queryPayment, setQueryPayment] = useState('')
  const [queryResult, setQueryResult] = useState<StatutoryRule | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Article>>({
    title: '',
    category: 'SOP',
    content: ''
  })

  useEffect(() => {
    // 1. Permission Check
    if (actualRole === 'Partner') {
      setIsAuthorized(true) // Partner Bypass
    } else if (actualRole === 'Founder') {
      setShowSecurityModal(true)
    } else {
      setIsAuthorized(true)
    }

    // 2. Load Data
    const stored = localStorage.getItem('knowledge_hub_articles')
    if (stored) {
      setArticles(JSON.parse(stored))
    } else {
      // Seed Data
      const initial: Article[] = [
        { 
            id: 1, 
            ref_no: 'KH-2024-001', 
            date: new Date().toISOString().split('T')[0], 
            title: 'Will Writing Guide - 4 Roles', 
            category: 'Client Guide', 
            status: 'Published', 
            created_by: 'Senior Lawyer',
            content: 'Roles: \n1. Testator (Person making the will)\n2. Executor (Administrator)\n3. Guardian (For minors)\n4. Witness (Two non-beneficiaries)\n\nKey Requirement: Mental capacity and free will.'
        },
        { 
            id: 2, 
            ref_no: 'KH-2024-002', 
            date: new Date().toISOString().split('T')[0], 
            title: 'EA Form (CP8A) Tax Rules', 
            category: 'HR Policy', 
            status: 'Published', 
            created_by: 'HR Dept',
            content: 'Deadline: 28 Feb annually.\nInclude: Salary, Bonus, Allowances, BIK.\nExemptions: Medical benefits, travel allowance (<RM6000).'
        }
      ]
      setArticles(initial)
      localStorage.setItem('knowledge_hub_articles', JSON.stringify(initial))
    }
  }, [actualRole])

  const handleSave = () => {
    if (!formData.title || !formData.content) return alert('Please fill in required fields')

    const newArticle: Article = {
      id: Date.now(),
      ref_no: `KH-2024-${String(articles.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      title: formData.title || '',
      category: (formData.category as any) || 'SOP',
      status: 'Published', 
      created_by: 'Current User', 
      content: formData.content || ''
    }

    const updated = [newArticle, ...articles]
    setArticles(updated)
    localStorage.setItem('knowledge_hub_articles', JSON.stringify(updated))
    setShowModal(false)
    setFormData({ title: '', category: 'SOP', content: '' })
  }
  
  // Interactive Query Logic
  useEffect(() => {
      if (queryPayment.length > 2) {
          const rule = statutoryRules.find(r => r.paymentType.toLowerCase().includes(queryPayment.toLowerCase()))
          setQueryResult(rule || null)
      } else {
          setQueryResult(null)
      }
  }, [queryPayment])

  const filtered = articles.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.ref_no.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const navigate = useNavigate() // Make sure to import useNavigate from 'react-router-dom'

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SecurityModal 
          isOpen={showSecurityModal}
          onClose={() => navigate('/')} // Redirect to Dashboard on Close/Cancel
          onSuccess={() => { setShowSecurityModal(false); setIsAuthorized(true); }}
          title="Restricted Access"
          message="Enter Security PIN to access Knowledge Hub."
        />
        <div className="text-center">
            <h2 className="text-xl font-bold text-gray-400">Verifying Access...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Knowledge Hub</h2>
            <p className="text-gray-500 text-sm mt-1">Central repository for firm knowledge, SOPs, and guides.</p>
        </div>
        <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
        >
            <Plus size={18} /> New Article
        </button>
      </div>
      <Breadcrumbs />

      {/* HR Interactive Tool */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
          <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2 mb-4">
              <Shield size={20} className="text-blue-600" /> 
              HR Statutory Checker
          </h3>
          <div className="flex gap-4 items-start">
              <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Check Payment Type</label>
                  <input 
                    className="w-full border border-blue-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Overtime, Bonus, Allowance..."
                    value={queryPayment}
                    onChange={e => setQueryPayment(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Type to instantly check statutory requirements.</p>
              </div>
              
              {queryResult && (
                  <div className="flex-1 bg-white p-4 rounded-lg border border-blue-200 shadow-sm animate-fade-in">
                      <h4 className="font-bold text-lg text-[#003366] mb-2">{queryResult.paymentType}</h4>
                      <div className="grid grid-cols-5 gap-2 text-center text-sm">
                          <div className={`p-2 rounded ${queryResult.epf ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <span className="block font-bold">EPF</span>
                              {queryResult.epf ? '✅' : '❌'}
                          </div>
                          <div className={`p-2 rounded ${queryResult.socso ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <span className="block font-bold">SOCSO</span>
                              {queryResult.socso ? '✅' : '❌'}
                          </div>
                          <div className={`p-2 rounded ${queryResult.eis ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <span className="block font-bold">EIS</span>
                              {queryResult.eis ? '✅' : '❌'}
                          </div>
                          <div className={`p-2 rounded ${queryResult.pcb ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <span className="block font-bold">PCB</span>
                              {queryResult.pcb ? '✅' : '❌'}
                          </div>
                          <div className={`p-2 rounded ${queryResult.hrdf ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <span className="block font-bold">HRDF</span>
                              {queryResult.hrdf ? '✅' : '❌'}
                          </div>
                      </div>
                      {queryResult.note && (
                          <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Note: {queryResult.note}
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <Search className="text-gray-400" size={20} />
        <input 
          className="flex-1 outline-none text-gray-700"
          placeholder="Search Articles (Title or Ref No)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 font-bold text-sm uppercase border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Ref No</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(article => (
              <tr key={article.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-[#003366] font-bold">{article.ref_no}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{article.date}</td>
                <td className="px-6 py-4 font-medium text-gray-800">
                    {article.title}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">{article.category}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                    {article.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Article Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                <BookOpen size={20} /> New Article
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as any})}
                  >
                    <option value="SOP">SOP</option>
                    <option value="Legal Precedent">Legal Precedent</option>
                    <option value="Client Guide">Client Guide</option>
                    <option value="System Manual">System Manual</option>
                    <option value="HR Policy">HR Policy</option>
                    <option value="Other">Other</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Content</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none h-32 resize-none" 
                    value={formData.content} 
                    onChange={e => setFormData({...formData, content: e.target.value})} 
                  />
               </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} className="px-8 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] flex items-center gap-2">
                <CheckCircle size={18} /> Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
