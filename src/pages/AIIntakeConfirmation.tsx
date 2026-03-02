import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { documentFactory, TempCaseStaging } from '../services/DocumentFactoryService'
import { Check, X, AlertTriangle, ArrowLeft, Loader } from 'lucide-react'

export default function AIIntakeConfirmation() {
  const { stagingId } = useParams<{ stagingId: string }>()
  const navigate = useNavigate()
  
  const [staging, setStaging] = useState<TempCaseStaging | null>(null)
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (stagingId) fetchStaging()
  }, [stagingId])

  const fetchStaging = async () => {
    const { data, error } = await supabase
      .from('temp_case_staging')
      .select('*')
      .eq('id', stagingId)
      .single()
    
    if (data) {
      setStaging(data)
      // Flatten structure for editing: { key: value }
      const flat: Record<string, any> = {}
      Object.entries(data.extracted_json).forEach(([k, v]: [string, any]) => {
        flat[k] = v.value
      })
      setData(flat)
    }
    setLoading(false)
  }

  const handleConfirm = async () => {
    if (!staging) return
    setProcessing(true)
    try {
      const caseId = await documentFactory.confirmStaging(staging.id, data)
      alert('Case Created Successfully!')
      navigate(`/case-details/${caseId}`)
    } catch (err) {
      console.error(err)
      alert('Failed to confirm case.')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!window.confirm('Reject this AI intake?')) return
    await supabase.from('temp_case_staging').update({ status: 'rejected' }).eq('id', stagingId)
    navigate('/')
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader className="animate-spin" /></div>
  if (!staging) return <div className="p-8">Staging Record Not Found</div>

  return (
    <div className="max-w-4xl mx-auto p-8">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-gray-800">
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-[#003366] text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Zap className="text-yellow-400" /> AI Intake Confirmation
            </h1>
            <p className="text-blue-200 text-sm mt-1">Source: {staging.raw_source} | Confidence: {staging.ai_confidence}</p>
          </div>
          <div className="px-3 py-1 bg-white/10 rounded text-xs font-mono">
             ID: {staging.id.slice(0, 8)}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6">
            {Object.entries(staging.extracted_json).map(([key, meta]: [string, any]) => {
              const confidence = meta.confidence || 0
              const isLowConfidence = confidence < 0.85
              
              return (
                <div key={key} className={`p-4 rounded-lg border ${isLowConfidence ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700 uppercase">{key.replace('_', ' ')}</label>
                    <span className={`text-xs font-mono ${isLowConfidence ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                      {isLowConfidence && <AlertTriangle size={12} className="inline mr-1" />}
                      {(confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>
                  <input 
                    className={`w-full p-2 border rounded focus:ring-2 focus:ring-[#003366] outline-none ${isLowConfidence ? 'border-red-300' : 'border-gray-300'}`}
                    value={data[key] || ''}
                    onChange={(e) => setData({ ...data, [key]: e.target.value })}
                  />
                  {isLowConfidence && (
                    <p className="text-xs text-red-500 mt-1">* Low confidence detected. Please verify manually.</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-gray-100">
             <button 
               onClick={handleReject}
               className="px-6 py-3 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
             >
               <X size={20} /> Reject Intake
             </button>
             <button 
               onClick={handleConfirm}
               disabled={processing}
               className="px-6 py-3 bg-[#003366] text-white font-bold rounded-lg shadow-md hover:bg-[#002244] transition-colors flex items-center gap-2 disabled:opacity-50"
             >
               {processing ? <Loader className="animate-spin" size={20} /> : <Check size={20} />}
               Confirm & Create Case
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
