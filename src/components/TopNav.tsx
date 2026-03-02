import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { currentRole, useRole, Role } from '../context/RoleContext'
import { 
  LayoutDashboard, 
  Briefcase, 
  DollarSign, 
  BrainCircuit, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Users,
  Building2,
  FileSearch,
  BookOpen,
  Activity,
  Globe,
  PenTool,
  Printer
} from 'lucide-react'

const roles: Role[] = ['Partner', 'Senior Clerk', 'Junior Clerk', 'Runner', 'Purchaser']

export default function TopNav() {
  const { t, i18n } = useTranslation()
  const { actualRole, impersonatedRole, setImpersonatedRole, setActualRole } = useRole()
  const location = useLocation()
  const current = currentRole({ actualRole, impersonatedRole, setActualRole: () => {}, setImpersonatedRole: () => {} })
  
  const [userName, setUserName] = useState<string>('LIM KAH LUN')
  const [userNric, setUserNric] = useState<string>('800101-14-5566')
  const [expandedHubs, setExpandedHubs] = useState<string[]>(['case', 'finance', 'ai', 'admin'])

  useEffect(() => {
    // Mock profile fetch
    setUserName('LIM KAH LUN')
    setUserNric('800101-14-5566')
  }, [])

  const handleImpersonationChange = (role: string) => {
    if (role) {
      setImpersonatedRole(role as Role)
    } else {
      setImpersonatedRole(undefined)
    }
  }

  const toggleHub = (hub: string) => {
    setExpandedHubs(prev => 
      prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]
    )
  }

  // --- Hub Configuration ---
  const hubs = [
    {
      id: 'case',
      label: 'CASE HUB',
      icon: Briefcase,
      color: 'text-blue-300',
      items: [
        { to: '/case/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/case/list', label: 'All Cases', icon: Briefcase },
        { to: '/case/new', label: 'New Case', icon: FileText },
        { to: '/case/status', label: 'Status Tracker', icon: Activity },
        { to: '/case/projects', label: 'Projects', icon: Building2 },
        { to: '/case/developers', label: 'Developers', icon: Users },
        { to: '/case/gov-gateway', label: 'Gov Gateway', icon: Globe },
      ]
    },
    {
      id: 'finance',
      label: 'FINANCE HUB',
      icon: DollarSign,
      color: 'text-green-300',
      items: [
        { to: '/finance/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/finance/invoices', label: 'Invoices & Billing', icon: FileText },
        { to: '/finance/payment-vouchers', label: 'Payment Vouchers', icon: Printer },
        { to: '/finance/settlement', label: 'Settlement', icon: DollarSign },
      ]
    },
    {
      id: 'ai',
      label: 'AI HUB',
      icon: BrainCircuit,
      color: 'text-purple-300',
      items: [
        { to: '/ai/smart-engine', label: 'Smart Engine', icon: BrainCircuit },
        { to: '/ai/documents', label: 'Doc Generator', icon: PenTool },
        { to: '/ai/recognition', label: 'OCR Scanner', icon: FileSearch },
        { to: '/ai/knowledge', label: 'Knowledge Base', icon: BookOpen },
      ]
    },
    {
      id: 'admin',
      label: 'ADMIN HUB',
      icon: Settings,
      color: 'text-gray-300',
      items: [
        { to: '/admin/staff', label: 'Staff Management', icon: Users },
        { to: '/admin/settings', label: 'System Settings', icon: Settings },
        { to: '/admin/pv-designer', label: 'PV Designer', icon: PenTool },
        { to: '/admin/ai-control', label: 'AI Control Center', icon: Activity },
      ]
    }
  ]

  return (
    <>
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#003366] text-white flex flex-col h-full shadow-2xl z-50 flex-shrink-0">
        
        {/* Brand */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-[#004080] shrink-0">
           <div className="bg-white text-[#003366] p-2 rounded-lg font-bold text-xl">LC</div>
           <div>
               <h1 className="text-xl font-bold font-montserrat tracking-tight leading-none">LawCase Pro</h1>
               <p className="text-[10px] text-blue-300 tracking-wider mt-1">LEGAL SUITE 2.0</p>
           </div>
        </div>

        {/* Founder Control (Mini) */}
        {actualRole === 'Founder' && (
            <div className="bg-yellow-400 text-[#003366] px-4 py-2 text-xs font-bold flex justify-between items-center shrink-0">
                <span>⚡ GOD MODE</span>
                <select 
                    value={impersonatedRole || ''} 
                    onChange={(e) => handleImpersonationChange(e.target.value)}
                    className="bg-white/20 border-none rounded px-1 py-0.5 text-xs focus:ring-0 cursor-pointer"
                >
                    <option value="">Default</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
        )}

        {/* Hub Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4 scrollbar-thin scrollbar-thumb-blue-800 scrollbar-track-transparent">
           
           {/* Global Dashboard Link */}
           <Link
              to="/"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                location.pathname === '/' 
                  ? 'bg-white/10 text-white shadow-inner border-l-4 border-white' 
                  : 'text-blue-100 hover:bg-[#004080]'
              }`}
           >
              <LayoutDashboard size={18} />
              Global Dashboard
           </Link>

           {hubs.map((hub) => (
             <div key={hub.id} className="space-y-1">
               {/* Hub Header */}
               <button 
                 onClick={() => toggleHub(hub.id)}
                 className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-white transition-colors"
               >
                 <div className="flex items-center gap-2">
                   <hub.icon size={14} className={hub.color} />
                   {hub.label}
                 </div>
                 {expandedHubs.includes(hub.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
               </button>

               {/* Hub Items */}
               {expandedHubs.includes(hub.id) && (
                 <div className="space-y-1 pl-2">
                   {hub.items.map((item) => {
                     const isActive = location.pathname.startsWith(item.to)
                     return (
                       <Link
                         key={item.to}
                         to={item.to}
                         className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                           isActive
                             ? 'bg-[#004080] text-white shadow-sm border-r-2 border-blue-400'
                             : 'text-blue-200 hover:bg-[#002855] hover:text-white'
                         }`}
                       >
                         <item.icon size={16} className={isActive ? 'text-blue-300' : 'text-blue-400/70'} />
                         {item.label}
                       </Link>
                     )
                   })}
                 </div>
               )}
             </div>
           ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-[#004080] bg-[#002855] shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-200 font-bold border border-blue-400/30">
                    {userName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{userName}</p>
                    <p className="text-xs text-blue-300 truncate font-mono">{userNric}</p>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-blue-300">
                <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${impersonatedRole ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                    {t(`roles.${current}`)}
                </span>
                <select 
                    value={i18n.language} 
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                    className="bg-[#003366] border border-[#004080] rounded px-1 py-0.5 text-xs focus:ring-0"
                >
                    <option value="en">EN</option>
                    <option value="ms">BM</option>
                    <option value="zh">CN</option>
                </select>
            </div>
        </div>
      </div>
    </>
  )
}