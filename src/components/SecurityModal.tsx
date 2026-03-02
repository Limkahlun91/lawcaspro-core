import { useState } from 'react'
import { X, Lock, KeyRound } from 'lucide-react'

interface SecurityModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  message?: string
}

export default function SecurityModal({ isOpen, onClose, onSuccess, title = "Security Verification", message = "Please enter your 6-digit PIN to proceed." }: SecurityModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === '000000') {
      onSuccess()
      setPin('')
      setError('')
    } else {
      setError('Invalid PIN. Access Denied.')
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-[400px] border border-gray-100 transform transition-all scale-100">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-red-50 rounded-xl">
               <Lock className="text-red-600" size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-gray-900">{title}</h3>
               <p className="text-xs text-gray-500 font-medium">Founder Access Control</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          {message}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="password"
              autoFocus
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#003366] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono text-lg tracking-widest text-center"
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''))
                setError('')
              }}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm font-bold flex items-center gap-2 justify-center bg-red-50 py-2 rounded-lg animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 6}
              className="flex-1 px-4 py-3 bg-[#003366] text-white font-bold rounded-xl hover:bg-[#002855] shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
            >
              Verify Identity
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
