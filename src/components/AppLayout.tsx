import { useState, useEffect } from 'react'
import { Outlet, useNavigate, Navigate } from 'react-router-dom'
import { Search, Smartphone } from 'lucide-react'
import TopNav from './TopNav'
import MobileDrawer from './MobileDrawer'
import SecurityModal from './SecurityModal'
import GlobalLoader from './GlobalLoader'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import GlobalSearchModal from './GlobalSearchModal'

export default function AppLayout() {
  const { session, profile, isFounder, loading, firmSettings } = useAuth()
  const [showFounderAuth, setShowFounderAuth] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [forceMobile, setForceMobile] = useState(false)
  const isSystemMobile = useIsMobile()
  const navigate = useNavigate()

  const isMobile = isSystemMobile || forceMobile

  useEffect(() => {
    if (loading) return

    // Founder 2FA Check - Firm Security Policy
    if (isFounder && firmSettings?.founder_pin_required) {
        const isVerified = localStorage.getItem('founder_2fa_verified') === 'true'
        if (!isVerified) {
          setShowFounderAuth(true)
        }
    }
  }, [isFounder, loading, navigate, firmSettings])

  if (loading) {
    return <GlobalLoader />
  }

  if (!session && !isFounder) {
     return <Navigate to="/login" replace />
  }

  const userName = profile?.full_name || (isFounder ? 'LIM KAH LUN (Founder)' : 'User')

  return (
    <>
      <GlobalSearchModal />
      <SecurityModal 
        isOpen={showFounderAuth}
        onClose={() => navigate('/login')} // Force logout/redirect if cancelled
        onSuccess={() => {
          localStorage.setItem('founder_2fa_verified', 'true')
          setShowFounderAuth(false)
        }}
        title="Founder Security Verification"
        message="System detected Founder Level Access. Please enter your 6-digit Security PIN to unlock the Dashboard."
      />
      
      {/* Mobile Drawer (Only visible on mobile) */}
      {isMobile && <MobileDrawer onExitMobile={forceMobile ? () => setForceMobile(false) : undefined} />}

      <div className="flex h-screen w-full">
        {/* Sidebar Navigation - Hidden on Mobile */}
        {!isMobile && <TopNav />}
        
        {/* Main Content Area */}
        <div className={`flex-1 overflow-auto bg-gray-50 relative ${isMobile ? 'pt-16' : ''}`}>
            {/* Header / Welcome Bar */}
            <div className={`sticky z-30 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm transition-all
                ${isMobile ? 'hidden' : 'top-0 px-8 py-3'}`}>
                
                <div className="w-96 relative group" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-[#003366]" size={16} />
                   <div 
                       className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-400 cursor-text hover:bg-white hover:ring-2 hover:ring-[#003366]/20 transition-all flex justify-between items-center"
                   >
                      <span>Search anything...</span>
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">Cmd K</kbd>
                   </div>
                </div>

                {/* Desktop Extras */}
                <div className="flex items-center gap-4">
                    {/* Mobile Preview Toggle */}
                        <button 
                            onClick={() => setForceMobile(!forceMobile)}
                            className={`p-2 rounded-lg transition-colors ${forceMobile ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title={forceMobile ? "Exit Mobile Preview" : "Mobile Preview Mode"}
                        >
                            <Smartphone size={20} />
                        </button>

                        <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
                           <span>System v2.0.1 (Stable)</span>
                           {userName && <span className="text-[#003366] font-bold">| {userName}</span>}
                        </div>
                    </div>
            </div>

            <div className={`${isMobile ? 'p-4' : 'p-8'} max-w-7xl mx-auto transition-all`}>
                <Outlet context={{ isMobile }} />
            </div>
        </div>
      </div>
    </>
  )
}
