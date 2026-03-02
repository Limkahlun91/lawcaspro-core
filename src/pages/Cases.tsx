'use client'

import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Eye, Clock, CheckCircle, Plus, UploadCloud, Lock, Edit, UserPlus, Search, Filter, Printer, Calendar, X, Trash2, ArrowUpDown, ChevronDown, AlertTriangle } from 'lucide-react'
import { useNavigate, Link, useOutletContext } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import { useRole, currentRole } from '../context/RoleContext'
import { Staff } from './StaffManagement'
import SecurityModal from '../components/SecurityModal'

// Extended Case Type
type Case = {
  id: number
  client: string
  fileRef: string
  project: string
  property_details: string
  caseType: string
  status: 'pending' | 'completed' | 'in_progress'
  progress: number // 0-100
  created_on: string
  closed_on?: string
  assigned_staff?: number[] // Staff IDs
  proof_url?: string
}

// Internal Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  isAlert?: boolean // If true, only show OK button
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, isAlert = false }: ConfirmationModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] border border-gray-100">
        <div className="flex items-center gap-3 mb-4 text-[#003366]">
          {isAlert ? <CheckCircle size={24} /> : <AlertTriangle size={24} className="text-yellow-600" />}
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          {!isAlert && (
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold text-sm">
              Cancel
            </button>
          )}
          <button 
            onClick={() => { onConfirm(); if(isAlert) onClose(); }} 
            className="px-6 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] text-sm shadow-md"
          >
            {isAlert ? 'OK' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Cases() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isMobile } = useOutletContext<{ isMobile: boolean }>() || { isMobile: false }
  const roleState = useRole()
  const role = currentRole(roleState)
  const isAdminOrPartner = ['Admin', 'Partner', 'Founder', 'SeniorLawyer'].includes(role)
  
  // Mock Current User ID (e.g. 1 for Lim Kah Lun)
  const currentUserId = 1

  const [cases, setCases] = useState<Case[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'my'>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Case, direction: 'asc' | 'desc' } | null>(null)

  // Filter Modal State
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('')

  // Modal State
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTarget, setAssignTarget] = useState<'single' | 'bulk'>('single')
  const [singleCaseId, setSingleCaseId] = useState<number | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  
  // Bulk Action Modals
  const [showBulkDateModal, setShowBulkDateModal] = useState(false)
  const [bulkDateType, setBulkDateType] = useState('SPA_Date')
  const [bulkDateValue, setBulkDateValue] = useState('')

  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false)
  const [bulkPrintTemplate, setBulkPrintTemplate] = useState('Acting Letter')

  // Delete Security State
  const [showDeleteAuth, setShowDeleteAuth] = useState(false)
  const [caseToDelete, setCaseToDelete] = useState<number | null>(null)

  // Generic Confirmation State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    isAlert?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    isAlert: false
  })

  const [staffList, setStaffList] = useState<Staff[]>([])

  useEffect(() => {
    // Load cases from localStorage
    const storedCases = localStorage.getItem('all_cases')
    if (storedCases) {
      setCases(JSON.parse(storedCases))
    } else {
      // Fallback Mock
      setCases([
        { 
          id: 1, 
          client: 'Tan & Co', 
          fileRef: 'LC/SPA/2026/001',
          project: 'Sunway Velocity Two',
          property_details: 'Unit A-10-05, Tower A',
          caseType: 'SPA', 
          status: 'in_progress',
          progress: 45,
          created_on: '2026-01-15',
          assigned_staff: [1, 2]
        },
        { 
          id: 2, 
          client: 'LHDN Direct', 
          fileRef: 'LC/LN/2026/042',
          project: 'Eco Majestic',
          property_details: 'Plot 42, Precint 5',
          caseType: 'Loan', 
          status: 'pending',
          progress: 10,
          created_on: '2026-02-01',
          assigned_staff: [3]
        },
        { 
          id: 3, 
          client: 'Maybank', 
          fileRef: 'LC/SPA/2026/005',
          project: 'Pavilion Bukit Jalil',
          property_details: 'Shop Lot G-05',
          caseType: 'SPA', 
          status: 'completed',
          progress: 100,
          created_on: '2025-12-20',
          closed_on: '2026-01-30',
          assigned_staff: [1]
        },
      ])
    }

    // Load staff list
    const storedStaff = localStorage.getItem('staff_list')
    if (storedStaff) {
      setStaffList(JSON.parse(storedStaff))
    } else {
      // Mock Staff if empty
      setStaffList([
        { id: 1, name: 'Lim Kah Lun', role: 'Partner', email: 'lim@lawcase.pro', status: 'Active' },
        { id: 2, name: 'Ali Bin Abu', role: 'Senior Clerk', email: 'ali@lawcase.pro', status: 'Active' },
        { id: 3, name: 'Sarah Tan', role: 'Senior Lawyer', email: 'sarah@lawcase.pro', status: 'Active' },
        { id: 4, name: 'Wong Wei Hong', role: 'Junior Lawyer', email: 'wong@lawcase.pro', status: 'Active' },
        { id: 5, name: 'Siti Aminah', role: 'Junior Clerk', email: 'siti@lawcase.pro', status: 'Active' },
        { id: 6, name: 'Muthu Sami', role: 'Runner', email: 'muthu@lawcase.pro', status: 'Active' }
      ])
    }
  }, [])

  const showAlert = (title: string, message: string) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      action: () => setConfirmState(prev => ({ ...prev, isOpen: false })),
      isAlert: true
    })
  }

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      action: () => {
        onConfirm()
        setConfirmState(prev => ({ ...prev, isOpen: false }))
      },
      isAlert: false
    })
  }

  const handleCreateCase = () => {
    navigate('/new-case')
  }

  const handleEditCase = (c: Case) => {
    // Mobile Lite Restriction
    if (isMobile) return
    
    // localStorage.setItem('current_case', JSON.stringify(c)) // Removed redundant storage
    navigate(`/case-edit/${c.id}`, { state: c })
  }

  const handleViewCase = (c: Case) => {
    localStorage.setItem('current_case', JSON.stringify(c))
    navigate(`/case-details/${c.id}`)
  }

  const handleDeleteRequest = (id: number) => {
    if (isMobile) return
    setCaseToDelete(id)
    setShowDeleteAuth(true)
  }

  const performDelete = () => {
    if (caseToDelete) {
      const updated = cases.filter(c => c.id !== caseToDelete)
      setCases(updated)
      localStorage.setItem('all_cases', JSON.stringify(updated))
      setShowDeleteAuth(false)
      setCaseToDelete(null)
      showAlert('Success', 'Case deleted successfully.')
    }
  }

  // --- Assignment Logic ---
  const openAssignModal = (c?: Case) => {
    if (c) {
      setAssignTarget('single')
      setSingleCaseId(c.id)
    } else {
      setAssignTarget('bulk')
    }
    setSelectedStaffId('')
    setShowAssignModal(true)
  }

  const performAssign = () => {
    if (!selectedStaffId) return

    const staffIdNum = Number(selectedStaffId)
    let updatedCases = [...cases]

    if (assignTarget === 'single' && singleCaseId) {
      updatedCases = updatedCases.map(item => {
        if (item.id === singleCaseId) {
          const currentStaff = item.assigned_staff || []
          if (!currentStaff.includes(staffIdNum)) {
            return { ...item, assigned_staff: [...currentStaff, staffIdNum] }
          }
        }
        return item
      })
    } else if (assignTarget === 'bulk') {
      updatedCases = updatedCases.map(item => {
        if (selectedIds.includes(item.id)) {
          const currentStaff = item.assigned_staff || []
          if (!currentStaff.includes(staffIdNum)) {
            return { ...item, assigned_staff: [...currentStaff, staffIdNum] }
          }
        }
        return item
      })
      setSelectedIds([])
    }

    setCases(updatedCases)
    localStorage.setItem('all_cases', JSON.stringify(updatedCases))
    setShowAssignModal(false)
    showAlert('Success', 'Staff assigned successfully!')
  }

  // --- Bulk Actions ---
  const handleExport = () => {
    const targetCases = selectedIds.length > 0 ? cases.filter(c => selectedIds.includes(c.id)) : cases

    const headers = ['ID', 'Client', 'File Ref', 'Project', 'Property', 'Type', 'Status', 'Progress', 'Created On', 'Closed On', 'Assigned Staff']
    const csvContent = [
      headers.join(','),
      ...targetCases.map(c => [
        c.id, 
        `"${c.client}"`, 
        c.fileRef || '', 
        `"${c.project || ''}"`,
        `"${c.property_details || ''}"`,
        c.caseType || '', 
        c.status,
        `${c.progress || 0}%`,
        c.created_on,
        c.closed_on || '',
        `"${(c.assigned_staff || []).map(id => staffList.find(s => s.id === id)?.name || id).join('; ')}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cases_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id))
    else setSelectedIds([...selectedIds, id])
  }

  // Bulk Status Logic
  const openBulkStatusModal = () => {
    if (selectedIds.length === 0) return
    setBulkDateValue(new Date().toISOString().split('T')[0])
    setShowBulkDateModal(true)
  }

  const performBulkStatusUpdate = () => {
    // Mock update logic
    setShowBulkDateModal(false)
    
    // Linked Action Logic
    if (bulkDateType.toLowerCase().includes('acting') || bulkDateType.toLowerCase().includes('letter')) {
      showConfirm(
        'Linked Action',
        `You updated ${bulkDateType}. Do you want to bulk print the corresponding letters?`,
        () => openBulkPrintModal()
      )
    } else {
      showAlert('Success', `Updated ${bulkDateType} to ${bulkDateValue} for ${selectedIds.length} cases.`)
      setSelectedIds([])
    }
  }

  // Bulk Print Logic
  const openBulkPrintModal = () => {
    if (selectedIds.length === 0) return
    setShowBulkPrintModal(true)
  }

  const performBulkPrint = () => {
    let count = 0
    const interval = setInterval(() => {
      count++
      console.log(`Generating PDF ${count}/${selectedIds.length}...`)
      if (count >= selectedIds.length) {
        clearInterval(interval)
        setShowBulkPrintModal(false)
        showAlert('Success', `Successfully generated ${selectedIds.length} PDFs for "${bulkPrintTemplate}".`)
        setSelectedIds([])
      }
    }, 300)
  }

  // Sorting Logic
  const handleSort = (key: keyof Case) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Filter & Sort Logic
  const filteredCases = cases.filter(c => {
    // 1. Permission Filter
    const hasAccess = isAdminOrPartner || (c.assigned_staff || []).includes(currentUserId)
    if (!hasAccess) return false

    // 2. View Filter (My Cases vs All)
    if (filter === 'my' && !(c.assigned_staff || []).includes(currentUserId)) return false

    // 3. Status & Project Filter (Advanced)
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterProject && !c.project.toLowerCase().includes(filterProject.toLowerCase())) return false

    // 4. Search Filter
    const search = searchTerm.toLowerCase()
    return (
      c.client.toLowerCase().includes(search) ||
      (c.fileRef || '').toLowerCase().includes(search) ||
      (c.project || '').toLowerCase().includes(search)
    )
  }).sort((a, b) => {
    if (!sortConfig) return 0
    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]
    
    if (aValue === undefined || bValue === undefined) return 0
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="space-y-6 relative">
      <SecurityModal 
        isOpen={showDeleteAuth}
        onClose={() => setShowDeleteAuth(false)}
        onSuccess={performDelete}
        title="Confirm Deletion"
        message="This action cannot be undone. Please enter PIN to confirm case deletion."
      />

      <ConfirmationModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        isAlert={confirmState.isAlert}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Cases</h2>
           <p className="text-gray-500 text-sm mt-1">Manage all active legal cases, assignments, and status.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 shadow-sm font-bold transition-transform active:scale-95"
          >
            <UploadCloud size={18} /> Export CSV
          </button>
          <button 
            onClick={handleCreateCase}
            className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
          >
            <Plus size={18} /> New Case
          </button>
        </div>
      </div>
      
      <Breadcrumbs />

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] outline-none"
            placeholder="Search clients, file ref, project..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowFilterModal(true)}
             className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 ${filterStatus !== 'all' || filterProject ? 'text-[#003366] border-[#003366] bg-blue-50' : ''}`}
           >
             <Filter size={16} /> Advanced Filters
           </button>
           <button 
             onClick={() => setFilter('all')}
             className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${filter === 'all' ? 'bg-blue-50 text-[#003366] border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
           >
             <Filter size={16} /> All Cases
           </button>
           <button 
             onClick={() => setFilter('my')}
             className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${filter === 'my' ? 'bg-blue-50 text-[#003366] border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
           >
             <UserPlus size={16} /> My Assigned
           </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#003366] text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-fade-in sticky top-4 z-10">
          <div className="font-bold flex items-center gap-2">
            <CheckCircle size={20} className="text-green-400" />
            {selectedIds.length} Cases Selected
          </div>
          <div className="flex gap-2">
            <button onClick={() => openAssignModal()} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold flex items-center gap-2">
              <UserPlus size={16} /> Assign Staff
            </button>
            <button onClick={openBulkStatusModal} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold flex items-center gap-2">
              <Calendar size={16} /> Update Date
            </button>
            <button onClick={openBulkPrintModal} className="px-4 py-2 bg-white text-[#003366] hover:bg-gray-100 rounded-lg font-bold flex items-center gap-2 shadow-sm">
              <Printer size={16} /> Bulk Print PDF
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card View vs Desktop Table View */}
      {isMobile ? (
        <div className="space-y-4 pb-20">
           {filteredCases.map((c) => (
             <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 active:scale-[0.99] transition-transform">
                <div className="flex justify-between items-start mb-3">
                   <div>
                      <h3 className="font-bold text-[#003366] text-lg">{c.client}</h3>
                      <p className="text-xs text-gray-500 font-mono">{c.fileRef || 'NO-REF'}</p>
                   </div>
                   <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    c.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    c.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                   <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Project:</span>
                      <span className="font-semibold text-gray-800 text-right">{c.project}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last Update:</span>
                      <span className="font-mono text-gray-600 text-right">{c.created_on}</span>
                   </div>
                   {/* Lite Mode: Hidden Progress/Staff for cleaner view */}
                </div>

                <div className="flex items-center justify-end border-t border-gray-100 pt-3">
                   <button 
                      onClick={() => handleViewCase(c)}
                      className="px-6 py-2 bg-[#003366] text-white text-sm font-bold rounded-lg shadow-sm w-full"
                   >
                      Open Case
                   </button>
                </div>
             </div>
           ))}
           {filteredCases.length === 0 && (
             <div className="text-center py-12 text-gray-400">
               <Search size={48} className="mx-auto mb-2 opacity-20" />
               <p>No cases found.</p>
             </div>
           )}
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1200px]">
          <thead className="bg-gray-50 text-gray-600 text-sm font-bold border-b border-gray-200 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4 w-10">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(filteredCases.map(c => c.id))
                    else setSelectedIds([])
                  }}
                  checked={selectedIds.length === filteredCases.length && filteredCases.length > 0}
                  className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                />
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('client')}>
                <div className="flex items-center gap-1">Client / File Ref <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('project')}>
                <div className="flex items-center gap-1">Project Details <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('progress')}>
                <div className="flex items-center gap-1">Progress <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">Status <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4">Assigned To</th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_on')}>
                <div className="flex items-center gap-1">Created <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('closed_on')}>
                <div className="flex items-center gap-1">Closed <ArrowUpDown size={14} /></div>
              </th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCases.map((c) => (
              <tr key={c.id} className={`hover:bg-blue-50/50 transition-colors group ${selectedIds.includes(c.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#003366] focus:ring-[#003366]"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <Link 
                      to={`/case-details/${c.id}`}
                      className="text-left font-bold text-[#0056b3] hover:underline text-lg"
                    >
                      {c.client}
                    </Link>
                    <span className="text-xs text-gray-500 font-mono">{c.fileRef || 'NO-REF'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                     <span className="font-semibold text-gray-800">{c.project}</span>
                     <span className="text-xs text-gray-500 truncate max-w-[200px]">{c.property_details}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${c.progress || 0}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-500 font-bold">{c.progress || 0}%</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    c.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    c.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {c.status === 'completed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                     {(c.assigned_staff || []).map((sid, i) => (
                       <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden" title={`Staff ID: ${sid}`}>
                         {staffList.find(s => s.id === sid)?.name.charAt(0) || sid}
                       </div>
                     ))}
                     {(c.assigned_staff || []).length === 0 && <span className="text-gray-400 text-sm italic">Unassigned</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                  {c.created_on}
                </td>
                <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                  {c.closed_on || '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openAssignModal(c)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                      title="Assign Staff"
                    >
                      <UserPlus size={18} />
                    </button>
                    <button 
                      onClick={() => handleEditCase(c)}
                      className="p-2 text-gray-500 hover:text-[#003366] hover:bg-blue-50 rounded-lg transition-colors" 
                      title="Edit Case"
                    >
                      <Edit size={18} />
                    </button>
                    {isAdminOrPartner && (
                      <button 
                        onClick={() => handleDeleteRequest(c.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete Case"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredCases.length === 0 && (
               <tr>
                 <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                   <div className="flex flex-col items-center gap-2">
                     <Search size={32} className="opacity-20" />
                     <p>No cases found matching your filters.</p>
                   </div>
                 </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Advanced Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] animate-fade-in">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                 <Filter size={20} /> Advanced Filters
               </h3>
               <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={20} />
               </button>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                   <select className="w-full border border-gray-300 rounded-lg px-4 py-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                     <option value="all">All Statuses</option>
                     <option value="pending">Pending</option>
                     <option value="in_progress">In Progress</option>
                     <option value="completed">Completed</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name</label>
                   <input className="w-full border border-gray-300 rounded-lg px-4 py-2" value={filterProject} onChange={e => setFilterProject(e.target.value)} placeholder="Filter by Project..." />
                </div>
             </div>
             <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => { setFilterStatus('all'); setFilterProject(''); setShowFilterModal(false); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Reset</button>
                <button onClick={() => setShowFilterModal(false)} className="px-4 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855]">Apply Filters</button>
             </div>
           </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                <UserPlus size={20} /> Assign Staff
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                {assignTarget === 'single' ? 'Assign staff to this case:' : `Assign staff to ${selectedIds.length} selected cases:`}
              </p>
              <select 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Select Staff --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={performAssign}
                disabled={!selectedStaffId}
                className="px-4 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Date Update Modal */}
      {showBulkDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                <Calendar size={20} /> Bulk Update Date
              </h3>
              <button onClick={() => setShowBulkDateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Select Date Field</label>
              <select 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                value={bulkDateType}
                onChange={e => setBulkDateType(e.target.value)}
              >
                 <option value="SPA_Date">SPA Date</option>
                 <option value="Loan_Date">Loan Agreement Date</option>
                 <option value="Acting_Letter_Date">Acting Letter Date</option>
                 <option value="Completion_Date">Completion Date</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">New Date</label>
              <input 
                type="date"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                value={bulkDateValue}
                onChange={e => setBulkDateValue(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowBulkDateModal(false)}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={performBulkStatusUpdate}
                className="px-4 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855]"
              >
                Update {selectedIds.length} Cases
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Print Modal */}
      {showBulkPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                <Printer size={20} /> Bulk Print Generator
              </h3>
              <button onClick={() => setShowBulkPrintModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Select Document Template</label>
              <select 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                value={bulkPrintTemplate}
                onChange={e => setBulkPrintTemplate(e.target.value)}
              >
                 <option value="Acting Letter">Acting Letter</option>
                 <option value="SPA Cover Letter">SPA Cover Letter</option>
                 <option value="Loan Agreement Cover">Loan Agreement Cover</option>
                 <option value="Bill of Cost">Bill of Cost</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                System will generate 1:1 Nitro PDF compatible documents for all {selectedIds.length} selected cases using the chosen template.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowBulkPrintModal(false)}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={performBulkPrint}
                className="px-4 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855]"
              >
                Generate PDFs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}