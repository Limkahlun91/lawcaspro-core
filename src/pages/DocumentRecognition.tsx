'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, CheckCircle, Loader, Search, Folder, Eye, Lock, AlertTriangle } from 'lucide-react'
import { documentAiService, ExtractedData } from '../services/documentAiService'
import SmartScanModal from '../components/SmartScanModal'

export default function DocumentRecognition() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('scan')
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<ExtractedData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSmartScanOpen, setIsSmartScanOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Mandatory Upload State
  const [uploadedFiles, setUploadedFiles] = useState({
      booking: false,
      mykad: false,
      lo: false
  })

  const checkMandatory = () => {
      return uploadedFiles.booking && uploadedFiles.mykad && uploadedFiles.lo
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleUpload(e.target.files[0])
    }
  }

  const handleUploadClick = () => {
    if (!checkMandatory()) {
        alert('Compliance Check Failed: Please upload Booking Form, MyKad, and Letter of Offer (LO) before proceeding with AI Scan.')
        return
    }
    fileInputRef.current?.click()
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    try {
        const data = await documentAiService.analyzeDocument(file)
        setResult(data)
    } catch (e) {
        console.error(e)
    } finally {
        setIsUploading(false)
    }
  }
  
  const toggleUpload = (key: keyof typeof uploadedFiles) => {
      setUploadedFiles(prev => ({...prev, [key]: !prev[key]}))
  }

  const [aiResult, setAiResult] = useState<any>(null)
  
  // AI Document Analysis Logic
  const handleAnalyze = async () => {
    if (!uploadedFiles.booking || !uploadedFiles.mykad || !uploadedFiles.lo) {
        alert('Please complete mandatory uploads first.')
        return
    }
    
    setIsUploading(true)
    
    try {
       // Simulate AI Call (Gemini/OpenAI)
       // In real implementation, upload file to storage, then send URL to AI service
       await new Promise(r => setTimeout(r, 2000))
       
       const mockAnalysis = {
           documentType: 'SPA',
           parties: ['Tan Ah Kow', 'Lim Kah Lun'],
           dates: ['2024-01-15', '2024-03-20'],
           clauses: [
               { id: 1, text: 'Clause 3.1: Payment Terms', risk: 'Low' },
               { id: 2, text: 'Clause 12: Termination', risk: 'High', note: 'Unusual penalty clause detected.' }
           ]
       }
       setAiResult(mockAnalysis)
       setResult({ // Also set OCR result for compatibility
           purchaser_name: 'Tan Ah Kow',
           ic_no: '911216015285',
           unit_no: 'A-12-05',
           spa_price: 550000,
           project_name: 'Eco Grandeur'
       } as any)
    } catch (err) {
       console.error(err)
       alert('AI Analysis Failed')
    } finally {
       setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#003366] font-montserrat">AI & Smart Search</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'scan' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500'}`}
          >
            AI OCR Scan
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'search' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500'}`}
          >
            Smart Search
          </button>
        </div>
      </div>

      {activeTab === 'scan' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center animate-fade-in">
          
          {/* Mandatory Upload Checklist */}
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} /> Compliance Requirement
              </h4>
              <div className="flex gap-4">
                  {['booking', 'mykad', 'lo'].map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={uploadedFiles[key as keyof typeof uploadedFiles]} 
                            onChange={() => toggleUpload(key as keyof typeof uploadedFiles)}
                            className="rounded text-[#003366] focus:ring-[#003366]" 
                          />
                          <span className="text-sm font-medium text-gray-700 capitalize">
                              {key === 'lo' ? 'Letter of Offer (LO)' : key.replace('mykad', 'MyKad Copy').replace('booking', 'Booking Form')}
                          </span>
                      </label>
                  ))}
              </div>
          </div>

          {!result ? (
            <div className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-12 transition-colors cursor-pointer relative ${
                    checkMandatory() ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
                onClick={handleUploadClick}
              >
                {!checkMandatory() && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-white px-4 py-2 rounded-lg shadow text-red-600 font-bold text-sm flex items-center gap-2">
                            <Lock size={16} /> Locked: Upload required docs first
                        </div>
                    </div>
                )}
                
                <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={handleFileChange}
                />
                {isUploading ? (
                  <Loader className="mx-auto text-[#0056b3] animate-spin" size={48} />
                ) : (
                  <Upload className="mx-auto text-gray-400" size={48} />
                )}
                <p className="mt-4 text-gray-600 font-medium">
                  {isUploading ? 'AI Engine Analyzing...' : 'Click to Upload SPA or Loan Agreement (PDF)'}
                </p>
                {!isUploading && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation()
                            handleAnalyze()
                        }}
                        className={`mt-4 px-6 py-2 rounded-lg font-bold text-white transition-colors z-20 relative ${checkMandatory() ? 'bg-[#003366] hover:bg-[#002855]' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                        Start AI Analysis
                    </button>
                )}
                <p className="text-sm text-gray-400 mt-2">Automatically extracts Purchaser, NRIC, Lot No, and Price</p>
              </div>
              
              <div className="flex justify-center">
                  <button 
                    onClick={() => {
                        if (!checkMandatory()) {
                            alert('Please complete mandatory uploads first.')
                            return
                        }
                        setIsSmartScanOpen(true)
                    }}
                    className={`flex items-center gap-2 font-bold hover:underline ${checkMandatory() ? 'text-[#003366]' : 'text-gray-400 cursor-not-allowed'}`}
                  >
                    <Eye size={16}/> Try the new Split-View Modal
                  </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                <CheckCircle size={24} />
                <span className="font-bold text-lg">Extraction Successful</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">Purchaser Name</p>
                  <p className="font-medium text-[#003366]">{result.purchaser_name}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">NRIC No</p>
                  <p className="font-medium text-[#003366]">{result.ic_no}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">Unit/Lot No</p>
                  <p className="font-medium text-[#003366]">{result.unit_no}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">Purchase Price</p>
                  <p className="font-medium text-[#003366]">RM {result.spa_price?.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => setResult(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Scan Another
                </button>
                <button 
                  className="px-6 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855] transition-colors"
                >
                  Create Case from Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Tab Content Omitted for Brevity - Keeping Existing */}
      {activeTab === 'search' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0056b3] outline-none"
                placeholder="Search cases, documents, clients (e.g. 'SPA 12345' or 'Ali')"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {searchQuery && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50 font-semibold text-gray-700">
                Search Results
              </div>
              <div className="divide-y divide-gray-100">
                <div className="p-4 hover:bg-blue-50 transition-colors flex items-center gap-4 cursor-pointer">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Folder size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-[#003366]">SPA-2026-001</p>
                    <p className="text-sm text-gray-500">Lim Kah Lun • Eco Grandeur • Lot 12345</p>
                  </div>
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {aiResult && (
        <div className="mt-6 bg-white p-6 rounded-xl border border-blue-200 shadow-sm animate-fade-in">
            <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2"><Loader className="animate-spin" /> AI Analysis Report</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="text-xs text-gray-500 uppercase font-bold">Document Type</span>
                    <p className="font-bold text-gray-800">{aiResult.documentType}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="text-xs text-gray-500 uppercase font-bold">Identified Parties</span>
                    <p className="font-bold text-gray-800">{aiResult.parties.join(', ')}</p>
                </div>
            </div>
            <div className="mt-4">
                <h4 className="font-bold text-gray-700 mb-2">Clause Review</h4>
                <ul className="space-y-2">
                    {aiResult.clauses.map((c: any) => (
                        <li key={c.id} className={`p-3 rounded border-l-4 ${c.risk === 'High' ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
                            <div className="flex justify-between">
                                <span className="font-medium text-gray-800">{c.text}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${c.risk === 'High' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>{c.risk} Risk</span>
                            </div>
                            {c.note && <p className="text-sm text-gray-600 mt-1 italic">{c.note}</p>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      )}
      
      <SmartScanModal 
        isOpen={isSmartScanOpen}
        onClose={() => setIsSmartScanOpen(false)}
        onApply={(data) => {
            setResult(data)
            setIsSmartScanOpen(false)
        }}
      />
    </div>
  )
}