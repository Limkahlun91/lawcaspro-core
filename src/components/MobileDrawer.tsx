import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Menu, X, Home, Briefcase, FileText, Settings, Users, 
  LogOut, PieChart, DollarSign, Activity, BookOpen, Truck, Search
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function MobileDrawer({ onExitMobile }: { onExitMobile?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { session } = useAuth()
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement global search logic or navigation
    console.log('Searching for:', searchQuery)
    setIsSearchOpen(false)
    // navigate(`/search?q=${searchQuery}`)
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Cases', path: '/cases', icon: <Briefcase size={20} /> },
    { name: 'Documents', path: '/documents', icon: <FileText size={20} /> },
    { name: 'Knowledge', path: '/knowledge-hub', icon: <BookOpen size={20} /> },
    // Mobile Lite: Hiding Admin/Finance/Staff for focused mobile experience
  ]

  const recentCases = [
      { id: 101, client: 'Tan & Co', fileRef: 'LC/SPA/2026/001' },
      { id: 102, client: 'LHDN Direct', fileRef: 'LC/LN/2026/042' },
      { id: 103, client: 'Maybank', fileRef: 'LC/SPA/2026/005' },
      { id: 104, client: 'Eco World', fileRef: 'LC/SPA/2026/008' },
      { id: 105, client: 'CIMB Bank', fileRef: 'LC/LN/2026/055' }
  ]

  const recentDocs = [
      'Letter of Offer - Tan & Co',
      'Advice for Drawdown - Maybank',
      'SPA Cover Letter - Eco World'
  ]

  return (
    <>
      {/* Mobile Header Bar - Visible when rendered (controlled by parent) */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-[#003366] text-lg">LawCase Pro</span>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
                <Search size={20} />
            </button>
            {/* Mobile User Avatar / Initials */}
            <div className="w-8 h-8 rounded-full bg-[#003366] text-white flex items-center justify-center text-xs font-bold">
                {session?.user?.email?.substring(0, 2).toUpperCase() || 'U'}
            </div>
        </div>
      </div>

      {/* Full Screen Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-white z-[60] animate-fade-in flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
             <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} className="text-gray-600" />
             </button>
             <form onSubmit={handleSearch} className="flex-1">
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search cases, clients, docs..."
                  className="w-full text-lg outline-none placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </form>
             <button onClick={handleSearch} className="p-2 text-[#003366] font-bold">
                Search
             </button>
          </div>
          <div className="p-6">
             <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Searches</p>
             <div className="flex flex-wrap gap-2 mb-6">
                 {['Tan & Co', 'SPA 2026', 'Maybank', 'Bukit Jalil'].map(term => (
                     <button key={term} onClick={() => setSearchQuery(term)} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium">
                         {term}
                     </button>
                 ))}
             </div>

             <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recently Opened</p>
             <div className="space-y-3">
                {recentCases.slice(0, 3).map(c => (
                   <button key={c.id} className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg text-left">
                       <div>
                           <p className="font-bold text-[#003366] text-sm">{c.client}</p>
                           <p className="text-[10px] text-gray-500 font-mono">{c.fileRef}</p>
                       </div>
                       <Briefcase size={16} className="text-gray-400" />
                   </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Content */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-xl text-[#003366]">Menu</h2>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-500" />
            </button>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-80px)]">
            {navItems.map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        location.pathname === item.path 
                        ? 'bg-blue-50 text-[#003366] font-bold' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    {item.icon}
                    <span>{item.name}</span>
                </Link>
            ))}
            
            <div className="pt-4 mt-4 border-t border-gray-100">
                <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Cases</p>
                <div className="px-4 space-y-2">
                    {recentCases.map(c => (
                        <Link key={c.id} to={`/case-details/${c.id}`} onClick={() => setIsOpen(false)} className="block p-3 bg-gray-50 rounded-lg active:bg-gray-100">
                            <p className="font-bold text-[#003366] text-sm">{c.client}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{c.fileRef}</p>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100">
                <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Generate</p>
                <div className="px-4 flex gap-2 overflow-x-auto pb-2">
                    <button className="flex-shrink-0 p-3 bg-blue-50 border border-blue-100 rounded-lg flex flex-col items-center gap-1 w-24">
                        <FileText size={16} className="text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-800">Gen. LO</span>
                    </button>
                    <button className="flex-shrink-0 p-3 bg-green-50 border border-green-100 rounded-lg flex flex-col items-center gap-1 w-24">
                        <FileText size={16} className="text-green-600" />
                        <span className="text-[10px] font-bold text-green-800">Advice</span>
                    </button>
                </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
                {onExitMobile && (
                    <button 
                        onClick={() => {
                            onExitMobile()
                            setIsOpen(false)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-bold"
                    >
                        <Settings size={20} />
                        <span>Exit Mobile Preview</span>
                    </button>
                )}
                <button 
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                </button>
            </div>
        </nav>
      </div>
    </>
  )
}
