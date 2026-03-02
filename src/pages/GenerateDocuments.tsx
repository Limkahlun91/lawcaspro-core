import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFirmCases } from '../hooks/useFirmCases'
import { FileText, Search, Zap, CheckCircle, Loader2, Building, Shield } from 'lucide-react'

interface Template {
  id: string
  name: string
  source: 'global' | 'firm'
  status?: 'draft' | 'ready' | 'archived'
  is_latest?: boolean
  version?: number
}

export default function GenerateDocuments() {
  const { session } = useAuth()
  const { cases, loading: casesLoading, searchCases } = useFirmCases()
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [templates, setTemplates] = useState<{ global: Template[], firm: Template[] }>({ global: [], firm: [] })
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null) // templateId being generated

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
      const timer = setTimeout(() => {
          if (searchTerm.length >= 2) searchCases(searchTerm)
      }, 500)
      return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchTemplates = async () => {
    if (!session?.access_token) return
    setLoadingTemplates(true)
    try {
      const res = await fetch('/api/docs/templates/list', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const { data } = await res.json()
      
      // Filter: Only show READY and LATEST templates for generation
      if (data) {
          const filterFn = (t: Template) => t.status === 'ready' && t.is_latest !== false
          setTemplates({
              global: data.global.filter(filterFn),
              firm: data.firm.filter(filterFn)
          })
      }
    } catch (err) {
      console.error('Fetch templates error:', err)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleGenerate = async (template: Template) => {
    if (!selectedCase) return alert('Please select a case first')
    if (!session?.access_token) return

    setGenerating(template.id)
    try {
      const res = await fetch('/api/docs/generate/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          caseId: selectedCase.id,
          templateId: template.id,
          source: template.source
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      alert(`Document Generated Successfully!\nFile: ${data.file_url}`)
      // In real app, trigger download or show success toast

    } catch (err: any) {
      console.error('Generate error:', err)
      alert(err.message || 'Generation failed')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left Panel: Case Selection */}
      <div className="w-1/3 border-r border-gray-200 bg-white p-6 flex flex-col">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-[#003366]" />
          Select Case
        </h2>
        
        <div className="relative mb-4">
          <input 
            type="text" 
            placeholder="Search client or ref..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {casesLoading ? (
             <div className="text-center py-4 text-gray-400">Searching...</div>
          ) : cases.length === 0 ? (
             <div className="text-center py-4 text-gray-400">No cases found</div>
          ) : (
             cases.map(c => (
               <button
                 key={c.id}
                 onClick={() => setSelectedCase(c)}
                 className={`w-full text-left p-3 rounded-lg border transition-all ${
                   selectedCase?.id === c.id 
                     ? 'bg-[#003366] text-white border-[#003366] shadow-md' 
                     : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                 }`}
               >
                 <div className="font-bold text-sm truncate">{c.client}</div>
                 <div className={`text-xs truncate ${selectedCase?.id === c.id ? 'text-blue-200' : 'text-gray-500'}`}>
                   {c.fileRef || 'No Ref'} • {c.project || 'General'}
                 </div>
               </button>
             ))
          )}
        </div>
      </div>

      {/* Right Panel: Template Selection */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-[#003366] mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6" />
          Document Generator
        </h2>

        {!selectedCase ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
            <Search className="w-12 h-12 mb-2 opacity-50" />
            <p>Please select a case from the left to view templates</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* System Templates */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> System Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.global.map(tmpl => (
                  <TemplateCard 
                    key={tmpl.id} 
                    template={tmpl} 
                    onGenerate={() => handleGenerate(tmpl)}
                    loading={generating === tmpl.id}
                  />
                ))}
                {templates.global.length === 0 && <p className="text-sm text-gray-400 italic">No system templates available.</p>}
              </div>
            </div>

            {/* Firm Templates */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building className="w-4 h-4" /> Firm Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.firm.map(tmpl => (
                  <TemplateCard 
                    key={tmpl.id} 
                    template={tmpl} 
                    onGenerate={() => handleGenerate(tmpl)}
                    loading={generating === tmpl.id}
                  />
                ))}
                 {templates.firm.length === 0 && <p className="text-sm text-gray-400 italic">No firm templates available.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({ template, onGenerate, loading }: { template: Template, onGenerate: () => void, loading: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <FileText className="w-5 h-5" />
        </div>
        <span className="font-medium text-gray-800">{template.name}</span>
      </div>
      <button 
        onClick={onGenerate}
        disabled={loading}
        className="px-3 py-1.5 bg-gray-50 text-[#003366] font-bold text-sm rounded-lg hover:bg-[#003366] hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
      </button>
    </div>
  )
}
