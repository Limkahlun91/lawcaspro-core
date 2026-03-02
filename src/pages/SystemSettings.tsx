'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Shield, Database, Globe, Save, RefreshCw, Lock, Book, FileText, Plus, Trash, Users, UploadCloud } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StaffManagement from './StaffManagement'
import Breadcrumbs from '../components/Breadcrumbs'
import SecurityModal from '../components/SecurityModal'
import { useRole, currentRole } from '../context/RoleContext'

type AuditLog = {
  id: number
  user: string
  action: string
  details: string
  timestamp: string
}

export default function SystemSettings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const roleState = useRole()
  const role = currentRole(roleState)
  
  // Security State
  const [isVerified, setIsVerified] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)

  const [activeTab, setActiveTab] = useState('general')
  const [companyInfo, setCompanyInfo] = useState({
    name: 'LawCase Pro Legal Firm',
    regNo: '123456-X',
    address: 'Level 10, Menara Law, 50450 Kuala Lumpur',
    email: 'admin@lawcase.pro',
    phone: '+603-2222 3333'
  })

  // LHDN Tax Profile State
  const [taxProfile, setTaxProfile] = useState({
    tin: 'C2584563200',
    msic: '69101',
    certStatus: 'Active',
    certExpiry: '2026-12-31'
  })
  
  useEffect(() => {
    // Founder Logic: Require 2FA on entry
    if (role === 'Founder' || role === 'Admin') {
      setShowSecurityModal(true)
    }
    
    // ... Load Data logic below
  }, [])

  const handleVerificationSuccess = () => {
    setIsVerified(true)
    setShowSecurityModal(false)
  }

  const handleVerificationClose = () => {
    // If they cancel verification, redirect them out
    if (!isVerified) {
      navigate('/')
    } else {
      setShowSecurityModal(false)
    }
  }

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Dictionary State
  const [dictTerms, setDictTerms] = useState([
    { key: 'spa', en: 'Sales & Purchase Agreement', ms: 'Perjanjian Jual Beli', zh: '買賣合約' },
    { key: 'loan', en: 'Loan Agreement', ms: 'Perjanjian Pinjaman', zh: '貸款合約' },
    { key: 'developer', en: 'Developer', ms: 'Pemaju', zh: '發展商' }
  ])

  const [docCategories, setDocCategories] = useState(['SPA', 'Loan', 'Lease', 'Correspondence', 'Notices'])
  const [newCategory, setNewCategory] = useState('')

  const handleAddCategory = () => {
    if (newCategory && !docCategories.includes(newCategory)) {
      const updated = [...docCategories, newCategory]
      setDocCategories(updated)
      localStorage.setItem('doc_categories', JSON.stringify(updated))
      setNewCategory('')
    }
  }

  const handleDeleteCategory = (cat: string) => {
    const updated = docCategories.filter(c => c !== cat)
    setDocCategories(updated)
    localStorage.setItem('doc_categories', JSON.stringify(updated))
  }

  useEffect(() => {
    // Load Company Info
    const savedInfo = localStorage.getItem('company_info')
    if (savedInfo) {
      setCompanyInfo(JSON.parse(savedInfo))
    }

    const savedTax = localStorage.getItem('tax_profile')
    if (savedTax) {
      setTaxProfile(JSON.parse(savedTax))
    }

    // Load Audit Logs from Local Storage
    const storedLogs = localStorage.getItem('audit_logs')
    if (storedLogs) {
      setAuditLogs(JSON.parse(storedLogs))
    } else {
      // Fallback Mock
      setAuditLogs([
        { id: 1, user: 'Lim Kah Lun', action: 'Update SPA Date', details: 'Changed from 20/01/2026 to 22/01/2026', timestamp: 'Today, 10:30 AM' },
        { id: 2, user: 'Admin', action: 'System Backup', details: 'Manual backup initiated', timestamp: 'Yesterday, 5:00 PM' },
        { id: 3, user: 'Sarah Tan', action: 'Login', details: 'Successful login from IP 192.168.1.10', timestamp: 'Yesterday, 9:00 AM' }
      ])
    }

    // Load Categories
    const savedCats = localStorage.getItem('doc_categories')
    if (savedCats) {
      setDocCategories(JSON.parse(savedCats))
    }
  }, [])

  return (
    <div className="space-y-6 relative">
      <SecurityModal 
        isOpen={showSecurityModal}
        onClose={handleVerificationClose}
        onSuccess={handleVerificationSuccess}
        title="Restricted Area"
        message="System Settings contains sensitive configuration. Please verify your identity."
      />

      <div className={`flex items-center justify-between transition-all duration-300 ${!isVerified ? 'blur-sm pointer-events-none' : ''}`}>
        <h2 className="text-2xl font-bold text-[#003366] font-montserrat flex items-center gap-2">
          <Settings size={28} /> System Administration
        </h2>
      </div>

      <div className={!isVerified ? 'blur-sm pointer-events-none' : ''}>
        <Breadcrumbs />

        <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Sidebar */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 bg-[#003366] text-white font-bold">Settings Menu</div>
          <nav className="p-2 space-y-1">
            <button 
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'general' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Globe size={18} /> Company Profile
            </button>
            <button 
              onClick={() => setActiveTab('staff')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'staff' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Users size={18} /> Staff Management
            </button>
            <button 
              onClick={() => setActiveTab('dictionary')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'dictionary' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Book size={18} /> Dictionary
            </button>
            <button 
              onClick={() => setActiveTab('documents')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'documents' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <FileText size={18} /> Document Settings
            </button>
            <button 
              onClick={() => setActiveTab('audit')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'audit' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Shield size={18} /> Audit Logs
            </button>
            <button 
              onClick={() => setActiveTab('backup')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'backup' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Database size={18} /> Backup & Data
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'security' ? 'bg-blue-50 text-[#003366] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Lock size={18} /> Security
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="col-span-9 bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[600px]">
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">Company Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Firm Name</label>
                  <input className="w-full border border-gray-300 rounded-lg px-4 py-2" value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Registration No</label>
                  <input className="w-full border border-gray-300 rounded-lg px-4 py-2" value={companyInfo.regNo} onChange={e => setCompanyInfo({...companyInfo, regNo: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-4 py-2 h-24" value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input className="w-full border border-gray-300 rounded-lg px-4 py-2" value={companyInfo.email} onChange={e => setCompanyInfo({...companyInfo, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <input className="w-full border border-gray-300 rounded-lg px-4 py-2" value={companyInfo.phone} onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})} />
                </div>
              </div>

              {/* Legal Firm Tax Profile */}
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6 mt-8 flex items-center gap-2">
                 <Shield size={20} className="text-[#003366]" /> Legal Firm Tax Profile (LHDN e-Invoice)
              </h3>
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 grid grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-bold text-[#003366] mb-1">Firm TIN No</label>
                    <input 
                        className="w-full border border-blue-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none font-mono" 
                        value={taxProfile.tin} 
                        onChange={e => setTaxProfile({...taxProfile, tin: e.target.value})} 
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-[#003366] mb-1">MSIC Code</label>
                    <input 
                        className="w-full border border-blue-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none font-mono" 
                        value={taxProfile.msic} 
                        onChange={e => setTaxProfile({...taxProfile, msic: e.target.value})} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: 69101 (Legal Activities)</p>
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-[#003366] mb-1">Digital Certificate Status</label>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-blue-200">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="font-bold text-green-700">{taxProfile.certStatus}</span>
                        <span className="text-xs text-gray-400 ml-auto">Expires: {taxProfile.certExpiry}</span>
                    </div>
                 </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={() => {
                    localStorage.setItem('company_info', JSON.stringify(companyInfo))
                    localStorage.setItem('tax_profile', JSON.stringify(taxProfile))
                    alert('Company & Tax Profile Saved!')
                  }}
                  className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-lg hover:bg-[#002855] transition-colors"
                >
                  <Save size={18} /> Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'staff' && <StaffManagement />}

          {activeTab === 'dictionary' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">Trilingual Dictionary Maintenance</h3>
              <p className="text-sm text-gray-500 mb-4">Edit system terminology across all supported languages.</p>
              
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Key</th>
                      <th className="px-6 py-3">English</th>
                      <th className="px-6 py-3">Bahasa Melayu</th>
                      <th className="px-6 py-3">中文</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dictTerms.map((term, i) => (
                      <tr key={term.key} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono text-xs text-gray-500">{term.key}</td>
                        <td className="px-6 py-3 font-medium text-gray-800">{term.en}</td>
                        <td className="px-6 py-3 text-gray-600">{term.ms}</td>
                        <td className="px-6 py-3 text-gray-600">{term.zh}</td>
                        <td className="px-6 py-3">
                          <button className="text-[#0056b3] hover:underline font-medium">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                 <button className="text-sm bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200">
                   + Add New Term
                 </button>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">Document Category Management</h3>
              <p className="text-sm text-gray-500 mb-4">Define categories for the Master Document Engine.</p>
              
              <div className="flex gap-2 mb-6">
                <input 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New Category Name (e.g. Litigation)"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                />
                <button 
                  onClick={handleAddCategory}
                  className="bg-[#003366] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#002855] flex items-center gap-2"
                >
                  <Plus size={18} /> Add Category
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docCategories.map(cat => (
                  <div key={cat} className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg group hover:border-blue-200 transition-colors">
                    <span className="font-semibold text-gray-700">{cat}</span>
                    <button 
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">System Audit Logs</h3>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">User</th>
                      <th className="px-6 py-3">Action</th>
                      <th className="px-6 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-500">{log.timestamp}</td>
                        <td className="px-6 py-3 font-medium text-gray-800">{log.user}</td>
                        <td className="px-6 py-3 text-[#003366] font-semibold">{log.action}</td>
                        <td className="px-6 py-3 text-gray-600">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">Database & Backup</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-[#003366] mb-2 flex items-center gap-2">
                    <RefreshCw size={20} /> Auto-Backup
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">System performs daily backups at 00:00 UTC. Last backup was successful.</p>
                  <div className="flex items-center gap-2 text-sm text-green-600 font-bold">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Active
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-2">Manual Export</h4>
                  <p className="text-sm text-gray-600 mb-4">Download a full JSON dump of all Cases, Clients, and Financial data.</p>
                  <button className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2">
                    <UploadCloud size={18} /> Download Full Backup
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">Security & Access Control</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <h4 className="font-bold text-[#003366]">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-gray-600">Require 2FA for all staff logins.</p>
                  </div>
                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full border border-gray-300 bg-gray-200 cursor-pointer">
                    <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform translate-x-0"></span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <div>
                    <h4 className="font-bold text-[#003366]">Session Timeout</h4>
                    <p className="text-sm text-gray-600">Auto-logout after 30 minutes of inactivity.</p>
                  </div>
                  <select className="bg-white border border-gray-300 rounded px-2 py-1 text-sm">
                    <option>15 mins</option>
                    <option>30 mins</option>
                    <option>1 hour</option>
                  </select>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <Lock size={16} /> Restricted Actions (RBAC)
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked readOnly className="text-red-600 rounded" />
                      <span className="text-sm text-red-700">Only <b>Partners</b> can approve invoices &gt; RM 10,000</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked readOnly className="text-red-600 rounded" />
                      <span className="text-sm text-red-700">Only <b>Admin</b> can delete case files</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}