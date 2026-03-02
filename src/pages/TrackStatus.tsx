'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, CheckCircle, Clock, FileText, ArrowRight, Smartphone } from 'lucide-react'
import QRCode from 'qrcode.react'
import Breadcrumbs from '../components/Breadcrumbs'

type CaseStatus = {
  stage: string
  date: string
  status: 'completed' | 'current' | 'pending'
  description: string
}

export default function TrackStatus() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = () => {
    if (!query) return
    setLoading(true)
    
    // Simulate API Search
    setTimeout(() => {
      // Mock Data
      if (query.length > 3) {
        setResult({
          caseId: 'LC/SPA/2026/001',
          property: 'No. 88, Jalan Property, 40000 Shah Alam',
          purchaser: 'LIM KAH LUN',
          currentStage: 'Loan Approved',
          timeline: [
            { stage: 'Case Created', date: '18/02/2026', status: 'completed', description: 'File opened and lawyers assigned.' },
            { stage: 'SPA Drafted', date: '20/02/2026', status: 'completed', description: 'Draft SPA sent to developer for consent.' },
            { stage: 'SPA Signed', date: '25/02/2026', status: 'completed', description: 'Both parties have signed the agreement.' },
            { stage: 'Loan Approved', date: '01/03/2026', status: 'current', description: 'Bank has issued Letter of Offer.' },
            { stage: 'SPA Stamped', date: '-', status: 'pending', description: 'Pending LHDN adjudication.' },
            { stage: 'Handover', date: '-', status: 'pending', description: 'Vacant Possession.' }
          ]
        })
      } else {
        setResult(null)
      }
      setLoading(false)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Public Header */}
      <div className="bg-[#003366] py-8 px-6 text-center text-white">
        <h1 className="text-3xl font-bold font-montserrat mb-2">LawCase Pro Tracker</h1>
        <p className="text-blue-200">Real-time case updates for our valued clients</p>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-6 -mt-8">
        {/* Search Box */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 animate-fade-in">
          <label className="block text-sm font-bold text-gray-700 mb-2">Track Your Case</label>
          <div className="flex gap-2">
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Case ID (e.g. LC/SPA/2026/001) or IC Number"
              className="flex-1 border border-gray-300 rounded-lg px-6 py-3 text-lg focus:ring-2 focus:ring-[#003366] outline-none transition-all"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="bg-[#003366] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#002855] transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={20} />}
              Track
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 ml-1">Try entering "SPA" or "800101"</p>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden animate-scale-in">
            <div className="bg-blue-50 p-6 border-b border-blue-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#003366] mb-1">{result.caseId}</h2>
                <p className="text-gray-600 font-medium">{result.property}</p>
                <p className="text-sm text-gray-500 mt-2">Client: <span className="font-bold text-gray-700">{result.purchaser}</span></p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-sm text-center">
                  <p className="text-xs text-gray-500 uppercase font-bold">Current Status</p>
                  <p className="text-lg font-bold text-blue-600">{result.currentStage}</p>
                </div>
                {/* Smart Tracker QR */}
                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
                   <QRCode value={`https://lawcase.pro/track/${result.caseId}`} size={48} />
                   <div className="text-xs text-gray-500">
                     <p className="font-bold text-[#003366] flex items-center gap-1"><Smartphone size={10} /> Mobile View</p>
                     <p>Scan to track</p>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-gray-200"></div>

                <div className="space-y-8">
                  {result.timeline.map((step: CaseStatus, i: number) => (
                    <div key={i} className="relative flex items-start gap-6 group">
                      {/* Icon */}
                      <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all ${
                        step.status === 'completed' ? 'bg-green-100 border-green-500 text-green-600' :
                        step.status === 'current' ? 'bg-blue-100 border-blue-500 text-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]' :
                        'bg-gray-50 border-gray-300 text-gray-400'
                      }`}>
                        {step.status === 'completed' ? <CheckCircle size={28} /> :
                         step.status === 'current' ? <Clock size={28} className="animate-pulse" /> :
                         <div className="w-3 h-3 bg-gray-300 rounded-full" />}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 p-4 rounded-xl border transition-all ${
                        step.status === 'current' ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-gray-100'
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <h3 className={`font-bold text-lg ${
                            step.status === 'completed' ? 'text-gray-800' :
                            step.status === 'current' ? 'text-[#003366]' : 'text-gray-400'
                          }`}>{step.stage}</h3>
                          <span className="text-sm font-mono text-gray-500">{step.date}</span>
                        </div>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">Need help? Contact our support at <a href="mailto:support@lawcase.pro" className="text-blue-600 font-bold hover:underline">support@lawcase.pro</a></p>
            </div>
          </div>
        )}
        
        {!result && !loading && query && (
          <div className="text-center py-12">
             <div className="bg-white p-8 rounded-full inline-block shadow-sm mb-4">
                <Search size={48} className="text-gray-300" />
             </div>
             <p className="text-gray-500 font-medium">No case found with that ID. Please check and try again.</p>
          </div>
        )}
      </div>
    </div>
  )
}