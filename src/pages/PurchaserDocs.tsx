'use client'

import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'

export default function PurchaserDocs() {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(2)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const [proofTimestamp, setProofTimestamp] = useState<string | null>(null)

  useEffect(() => {
    // Check for proof from RunnerTasks (Demo only)
    const storedProof = localStorage.getItem('runner-proof-1') // Assuming task 1 is related
    if (storedProof) {
      try {
        const parsed = JSON.parse(storedProof)
        setProofUrl(parsed.url)
        setProofTimestamp(parsed.timestamp)
        setCurrentStep(3)
      } catch {
        setProofUrl(storedProof)
        setCurrentStep(3)
      }
    }
  }, [])

  const steps = [
    { id: 1, label: 'Case Opened', date: '10 Feb 2026' },
    { id: 2, label: 'Docs Signing', date: '12 Feb 2026' },
    { id: 3, label: 'Stamp Office', date: 'In Progress' },
    { id: 4, label: 'Loan Release', date: 'Pending' },
    { id: 5, label: 'Keys Handover', date: 'Pending' },
  ]

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, LIM KAH LUN</h1>
          <p className="text-gray-500 text-sm mt-1">Case No: <span className="font-mono font-medium text-gray-700">SPA-2026-001</span></p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Property</div>
          <div className="font-medium text-gray-800">Residensi LawCase, Unit A-10-01</div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-8">Case Timeline</h2>
        
        <div className="relative">
          {/* Progress Bar Background */}
          <div className="absolute top-4 left-0 w-full h-1 bg-gray-200 rounded"></div>
          
          {/* Active Progress Bar */}
          <div 
            className="absolute top-4 left-0 h-1 bg-blue-600 rounded transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          ></div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step) => {
              const isCompleted = step.id < currentStep
              const isCurrent = step.id === currentStep
              
              return (
                <div key={step.id} className="flex flex-col items-center group">
                  <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 z-10 transition-colors duration-300 ${
                      isCompleted 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : isCurrent 
                          ? 'bg-white border-blue-600 text-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.2)]' 
                          : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? '✓' : step.id}
                  </div>
                  <div className="mt-4 text-center">
                    <div className={`text-sm font-semibold transition-colors ${
                      isCurrent ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-medium">{step.date}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Status Detail */}
        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-4">
          <div className={`p-2 rounded-full ${proofUrl ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {proofUrl ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <div>
            <h3 className={`font-semibold ${proofUrl ? 'text-green-900' : 'text-blue-900'}`}>
              {proofUrl ? 'Current Status: Completed (Proof Uploaded)' : 'Current Status: Stamp Office'}
            </h3>
            <p className={`${proofUrl ? 'text-green-700' : 'text-blue-700'} text-sm mt-1`}>
              {proofUrl 
                ? 'Your documents have been successfully processed by our runner. Please check the proof below.'
                : 'Your documents are currently with the Stamp Office for adjudication. This process typically takes 3-5 working days.'}
            </p>
            {proofUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Latest Status Update (from Runner) 
                  {proofTimestamp && <span className="text-xs font-normal text-gray-500 ml-2">[{proofTimestamp}]</span>}
                  :
                </p>
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="inline-block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <img src={proofUrl} alt="Status Proof" className="h-32 object-cover" />
                  <div className="bg-white px-3 py-1 text-xs text-gray-500 border-t">Click to enlarge</div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('nav.purchaserDocs')}</h2>
        <div className="space-y-2">
          {['Sales and Purchase Agreement (Signed)', 'Loan Offer Letter', 'Identity Verification'].map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="text-red-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-700">{doc}</div>
                  <div className="text-xs text-gray-400">PDF • 2.4 MB • Uploaded on 12 Feb 2026</div>
                </div>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50">
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}