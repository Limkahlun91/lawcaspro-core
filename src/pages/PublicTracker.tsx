'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, MessageSquare, Calendar, Send, Image } from 'lucide-react'

type Message = {
  id: number
  text: string
  sender: 'client' | 'firm'
  timestamp: string
}

export default function PublicTracker() {
  const { t } = useTranslation()
  const [nric, setNric] = useState('')
  const [caseData, setCaseData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'status' | 'messages' | 'booking'>('status')
  
  // Messaging
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Hello, when can I sign the SPA?', sender: 'client', timestamp: 'Yesterday 10:00 AM' },
    { id: 2, text: 'Hi, you can come in next Tuesday.', sender: 'firm', timestamp: 'Yesterday 11:30 AM' }
  ])
  const [newMessage, setNewMessage] = useState('')

  const handleSearch = () => {
    // Mock search logic
    if (nric === '800101-14-5566') {
      const stored = localStorage.getItem('current_case')
      if (stored) {
        setCaseData(JSON.parse(stored))
      } else {
        // Fallback mock
        setCaseData({
          project_name: 'Eco Grandeur Phase 1',
          lot_no: 'Lot 12345',
          status_step: 2 // 0-3
        })
      }
    } else {
      alert('Case not found')
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim()) return
    setMessages([...messages, { id: Date.now(), text: newMessage, sender: 'client', timestamp: 'Just now' }])
    setNewMessage('')
  }

  const steps = [
    { label: 'Document Preparation', desc: 'SPA drafting & signing' },
    { label: 'Client Review', desc: 'Waiting for client signature' },
    { label: 'Bank Verification', desc: 'Loan approval & processing' },
    { label: 'Final Completion', desc: 'Handover & key collection' }
  ]

  const currentStep = 2 // Mock current step

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20 px-4 pb-20">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-8 border-b border-gray-200 text-center bg-[#003366] text-white">
          <h1 className="text-3xl font-bold font-montserrat mb-2">LawCase Pro Tracker</h1>
          <p className="opacity-80">Secure Client Portal</p>
        </div>

        {!caseData ? (
          <div className="p-12">
            <p className="text-gray-500 text-center mb-8">Enter your NRIC to access your case dashboard</p>
            <div className="flex gap-4 max-w-lg mx-auto">
              <input 
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-[#0056b3] outline-none"
                placeholder="e.g. 800101-14-5566"
                value={nric}
                onChange={e => setNric(e.target.value)}
              />
              <button 
                onClick={handleSearch}
                className="bg-[#0056b3] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#004494] transition-colors flex items-center gap-2"
              >
                <Search size={20} /> Access
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex border-b border-gray-200">
              <button 
                onClick={() => setActiveTab('status')}
                className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === 'status' ? 'text-[#003366] border-b-2 border-[#003366] bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Case Status
              </button>
              <button 
                onClick={() => setActiveTab('messages')}
                className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === 'messages' ? 'text-[#003366] border-b-2 border-[#003366] bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Messages
              </button>
              <button 
                onClick={() => setActiveTab('booking')}
                className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === 'booking' ? 'text-[#003366] border-b-2 border-[#003366] bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Book Appointment
              </button>
            </div>

            <div className="p-8 min-h-[400px]">
              {activeTab === 'status' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                    <h3 className="font-bold text-[#003366] text-lg mb-2">{caseData.project_name}</h3>
                    <p className="text-gray-600">Unit: <span className="font-semibold">{caseData.lot_no}</span></p>
                  </div>

                  <div className="relative py-8">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 transition-all duration-1000"
                      style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                    ></div>
                    
                    <div className="relative z-10 flex justify-between">
                      {steps.map((step, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-2 transition-colors ${
                            i <= currentStep ? 'bg-green-500' : 'bg-gray-300'
                          }`}>
                            {i + 1}
                          </div>
                          <p className={`text-sm font-bold ${i <= currentStep ? 'text-[#003366]' : 'text-gray-400'}`}>{step.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 font-medium">
                    Current Stage: {steps[currentStep].label}
                  </div>

                  {/* Recent Photo Receipts */}
                  <div className="pt-6 border-t border-gray-100">
                    <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2">
                      <Image size={20} /> Recent Documents
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="aspect-square bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors group">
                        <div className="text-center">
                          <Image className="mx-auto text-gray-400 group-hover:text-[#003366]" size={24} />
                          <span className="text-xs text-gray-500 mt-1 block">SPA Receipt</span>
                        </div>
                      </div>
                      <div className="aspect-square bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors group">
                        <div className="text-center">
                          <Image className="mx-auto text-gray-400 group-hover:text-[#003366]" size={24} />
                          <span className="text-xs text-gray-500 mt-1 block">Stamping</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="flex flex-col h-[400px] animate-fade-in">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded-xl ${
                          msg.sender === 'client' 
                            ? 'bg-[#003366] text-white rounded-br-none' 
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender === 'client' ? 'text-blue-200' : 'text-gray-500'}`}>{msg.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <input 
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0056b3] outline-none"
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button 
                      onClick={sendMessage}
                      className="bg-[#0056b3] text-white p-2 rounded-lg hover:bg-[#004494] transition-colors"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'booking' && (
                <div className="space-y-6 animate-fade-in text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-blue-100 text-[#003366] rounded-full flex items-center justify-center mb-4">
                    <Calendar size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-[#003366]">Schedule an Appointment</h3>
                  <p className="text-gray-600 max-w-md mx-auto">Select a date to meet with your lawyer for document signing or consultation.</p>
                  
                  <div className="max-w-xs mx-auto space-y-4">
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#0056b3]" />
                    <select className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#0056b3]">
                      <option>10:00 AM</option>
                      <option>11:00 AM</option>
                      <option>02:00 PM</option>
                      <option>03:00 PM</option>
                    </select>
                    <button className="w-full bg-[#003366] text-white py-3 rounded-lg font-bold hover:bg-[#002855] transition-colors">
                      Confirm Booking
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}