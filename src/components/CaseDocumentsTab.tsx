import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FileText, Download, Plus, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface GeneratedDoc {
  id: string
  template_name: string
  template_source: 'global' | 'firm'
  file_url: string
  generated_at: string
}

export default function CaseDocumentsTab({ caseId }: { caseId?: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [docs, setDocs] = useState<GeneratedDoc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (caseId) fetchDocs()
  }, [caseId])

  const fetchDocs = async () => {
    if (!session?.access_token || !caseId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/docs/generate/list?caseId=${caseId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const { data } = await res.json()
      if (data) setDocs(data)
    } catch (err) {
      console.error('Fetch docs error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (url: string) => {
    // In real app, this might be a signed URL or direct download
    // For manual system, user clicks the link
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-[#003366]">Generated Documents</h3>
        <button
          onClick={() => navigate('/ai/generate')} // Ideally pass caseId state
          className="flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855] font-bold text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Generate New
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-bold text-xs">
            <tr>
              <th className="px-6 py-3">Template Name</th>
              <th className="px-6 py-3">Source</th>
              <th className="px-6 py-3">Generated At</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading documents...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  No documents generated yet.
                </td>
              </tr>
            ) : (
              docs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </div>
                    {doc.template_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      doc.template_source === 'global' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {doc.template_source === 'global' ? 'System' : 'Firm'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(doc.generated_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDownload(doc.file_url)}
                      className="text-[#003366] hover:text-blue-800 font-bold flex items-center gap-1 justify-end ml-auto"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
