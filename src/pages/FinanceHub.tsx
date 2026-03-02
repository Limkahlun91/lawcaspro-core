
import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Printer, FileText, DollarSign, CheckCircle, X, Shield, Clock, UserCheck, ArrowRight, Wallet, TrendingUp, PieChart, LayoutDashboard, Book, Lock, Activity, List } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'
import SecurityModal from '../components/SecurityModal'
import { useRole } from '../context/RoleContext'
import { numberToWords } from '../utils/numberToWords'
import PaymentVouchers from './PaymentVouchers'
import Invoice from './Invoice'
import { legalAI } from '../modules/ai/legal_ai.service'
import { financeService } from '../services/financeService'
import { formatCurrency } from '../utils/formatters'
import { supabase } from '../lib/supabaseClient'

export default function FinanceHub() {
 const { actualRole } = useRole()
  const [activeTab, setActiveTab] = useState<'overview' | 'pv' | 'invoice' | 'reports' | 'gl' | 'audit'>('overview')
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [sstData, setSstData] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [glEntries, setGlEntries] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([]) // e-Invoices State

  // Field-Level Security & Role-Based Tabs
  // Only Account/Founder/Partner see GL & Reports
  const canViewLedger = ['Founder', 'Partner', 'Account'].includes(actualRole)
  
  // If Lawyer/Clerk enters, force 'pv' or 'invoice' view, hide sensitive tabs
  useEffect(() => {
      if (!canViewLedger && (activeTab === 'overview' || activeTab === 'reports' || activeTab === 'gl' || activeTab === 'audit')) {
          setActiveTab('pv')
      }
  }, [actualRole])

  useEffect(() => {
      // Load Reports Data
      if (activeTab === 'reports') {
          const pl = financeService.getPL()
          const bs = financeService.getBalanceSheet()
          setReportData({ pl, bs })
          financeService.getSSTReport().then(setSstData)
      }
      
      // Load Audit Logs (Real from DB)
      if (activeTab === 'audit') {
          fetchAuditLogs()
      }

      // Load GL Entries (Real from DB)
      if (activeTab === 'gl') {
          fetchGlEntries()
      }

      // Load e-Invoices
      if (activeTab === 'invoice') {
          // Mock or Load from Supabase
          setInvoices([
             { id: 'INV-001', uuid: '123e4567-e89b-12d3-a456-426614174000', status: 'VALIDATED', amount: 1500, date: '2024-03-15' },
             { id: 'INV-002', uuid: '', status: 'DRAFT', amount: 2300, date: '2024-03-20' }
          ])
      }
  }, [activeTab])

  const fetchAuditLogs = async () => {
      const { data } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50)
      if (data) setAuditLogs(data)
  }

  const fetchGlEntries = async () => {
      // Fetch GL with Lines
      const { data } = await supabase.from('gl_entries').select('*, gl_lines(*)').order('date', { ascending: false })
      if (data) setGlEntries(data)
  }

  const handleRestrictedTab = (tab: 'gl' | 'audit') => {
      if (actualRole === 'Partner' || actualRole === 'Account') {
          setActiveTab(tab)
          return
      }

      if (actualRole === 'Founder') {
          if (isAuthorized) {
              setActiveTab(tab)
          } else {
              setShowSecurityModal(true)
          }
      } else {
          alert('Access Denied: Authorized Personnel Only')
      }
  }

  return (
    <div className="space-y-6">
       <SecurityModal 
          isOpen={showSecurityModal}
          onClose={() => setShowSecurityModal(false)}
          onSuccess={() => { setShowSecurityModal(false); setIsAuthorized(true); setActiveTab('gl'); }} // Default to GL after unlock
          title="Restricted Financial Access"
          message="Founder/Partner Authorization Required. Enter PIN to view General Ledger & Audit Logs."
       />

       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight flex items-center gap-2">
                    <Wallet size={32} /> Finance Hub
                </h2>
                <p className="text-gray-500 text-sm mt-1">Centralized accounting, billing, and expense management.</p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <LayoutDashboard size={16} /> Overview
                </button>
                <button 
                    onClick={() => setActiveTab('pv')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'pv' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign size={16} /> Expenses
                </button>
                <button 
                    onClick={() => setActiveTab('invoice')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'invoice' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FileText size={16} /> Billing
                </button>
                {canViewLedger && (
                    <button 
                        onClick={() => setActiveTab('reports')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'reports' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <PieChart size={16} /> Reports
                    </button>
                )}
                {canViewLedger && (
                    <button 
                        onClick={() => handleRestrictedTab('gl')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'gl' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Book size={16} /> GL
                    </button>
                )}
                {canViewLedger && (
                    <button 
                        onClick={() => handleRestrictedTab('audit')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'audit' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Shield size={16} /> Audit
                    </button>
                )}
            </div>
       </div>

       {activeTab === 'overview' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
               <div className="bg-gradient-to-br from-[#003366] to-[#004080] p-6 rounded-2xl text-white shadow-lg">
                   <div className="flex items-center gap-3 mb-4 opacity-80">
                       <Wallet size={24} />
                       <span className="font-bold uppercase tracking-wider text-xs">Total Revenue (YTD)</span>
                   </div>
                   <div className="text-4xl font-bold mb-2">RM 1,250,000</div>
                   <div className="flex items-center gap-1 text-green-300 text-sm font-bold">
                       <TrendingUp size={16} /> +15% from last month
                   </div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                   <div className="flex items-center gap-3 mb-4 text-gray-500">
                       <FileText size={24} />
                       <span className="font-bold uppercase tracking-wider text-xs">Pending Invoices</span>
                   </div>
                   <div className="text-4xl font-bold text-gray-800 mb-2">12</div>
                   <div className="text-sm text-gray-500">Totaling <span className="font-bold text-[#003366]">RM 45,200</span></div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                   <div className="flex items-center gap-3 mb-4 text-gray-500">
                       <DollarSign size={24} />
                       <span className="font-bold uppercase tracking-wider text-xs">Pending PV Approval</span>
                   </div>
                   <div className="text-4xl font-bold text-gray-800 mb-2">5</div>
                   <div className="text-sm text-gray-500">Action required by <span className="font-bold text-red-500">Partner</span></div>
               </div>
               
               {/* Shortcuts */}
               <div className="md:col-span-3 bg-gray-50 rounded-xl p-6 border border-gray-200">
                   <h3 className="font-bold text-gray-700 mb-4">Quick Actions</h3>
                   <div className="flex gap-4">
                       <button onClick={() => setActiveTab('pv')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-bold text-[#003366]">Create Payment Voucher</button>
                       <button onClick={() => setActiveTab('invoice')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-bold text-[#003366]">Issue Invoice</button>
                   </div>
               </div>
           </div>
       )}

       {activeTab === 'pv' && (
           <div className="animate-fade-in">
               <PaymentVouchers embedded={true} />
           </div>
       )}

       {activeTab === 'invoice' && (
           <div className="animate-fade-in space-y-6">
               <Invoice />
               
               {/* e-Invoice Status Dashboard */}
               <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2">
                       <Shield size={20} /> e-Invoice Compliance (MyInvois)
                   </h3>
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-gray-100 text-gray-600 uppercase">
                               <tr>
                                   <th className="p-3">Invoice No</th>
                                   <th className="p-3">Date</th>
                                   <th className="p-3">LHDN UUID</th>
                                   <th className="p-3">Status</th>
                                   <th className="p-3 text-right">Amount</th>
                                   <th className="p-3 text-center">QR</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {invoices.map((inv: any, i: number) => (
                                   <tr key={i}>
                                       <td className="p-3 font-bold">{inv.id}</td>
                                       <td className="p-3">{inv.date}</td>
                                       <td className="p-3 font-mono text-xs text-gray-500">{inv.uuid || '-'}</td>
                                       <td className="p-3">
                                           <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                               inv.status === 'VALIDATED' ? 'bg-green-100 text-green-700' : 
                                               inv.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-700' : 
                                               'bg-gray-100 text-gray-600'
                                           }`}>
                                               {inv.status}
                                           </span>
                                       </td>
                                       <td className="p-3 text-right font-bold">{formatCurrency(inv.amount)}</td>
                                       <td className="p-3 text-center">
                                           {inv.status === 'VALIDATED' && <div className="w-6 h-6 bg-gray-900 mx-auto rounded-sm"></div>}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
       )}
       
       {activeTab === 'reports' && reportData && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
               {/* P&L */}
               <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2"><TrendingUp /> Profit & Loss (P&L)</h3>
                   <div className="space-y-4">
                       <div className="flex justify-between p-3 bg-green-50 rounded text-green-800">
                           <span className="font-bold">Total Revenue</span>
                           <span className="font-bold">{formatCurrency(reportData.pl.revenue)}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-red-50 rounded text-red-800">
                           <span className="font-bold">Total Expenses</span>
                           <span className="font-bold">{formatCurrency(reportData.pl.expense)}</span>
                       </div>
                       <div className="flex justify-between p-4 border-t-2 border-gray-800 text-xl font-bold">
                           <span>Net Profit</span>
                           <span className={reportData.pl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                               {formatCurrency(reportData.pl.netProfit)}
                           </span>
                       </div>
                   </div>
               </div>

               {/* Balance Sheet Summary */}
               <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2"><Wallet /> Balance Sheet</h3>
                   <div className="space-y-4">
                       <div className="flex justify-between p-3 bg-blue-50 rounded text-blue-800">
                           <span className="font-bold">Total Assets</span>
                           <span className="font-bold">{formatCurrency(reportData.bs.assets)}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-orange-50 rounded text-orange-800">
                           <span className="font-bold">Total Liabilities</span>
                           <span className="font-bold">{formatCurrency(reportData.bs.liabilities)}</span>
                       </div>
                       <div className="flex justify-between p-3 bg-purple-50 rounded text-purple-800">
                           <span className="font-bold">Total Equity</span>
                           <span className="font-bold">{formatCurrency(reportData.bs.equity)}</span>
                       </div>
                   </div>
               </div>

               {/* SST Report */}
               <div className="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2"><Shield /> SST Compliance Report</h3>
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-gray-100 text-gray-600 uppercase">
                               <tr>
                                   <th className="p-3">Date</th>
                                   <th className="p-3">Description</th>
                                   <th className="p-3">Ref ID</th>
                                   <th className="p-3 text-right">Tax Amount (Credit)</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {sstData.length === 0 ? (
                                   <tr><td colSpan={4} className="p-4 text-center text-gray-500">No SST transactions found.</td></tr>
                               ) : (
                                   sstData.map((t, i) => (
                                       <tr key={i}>
                                           <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                                           <td className="p-3">{t.description}</td>
                                           <td className="p-3 font-mono">{t.referenceId}</td>
                                           <td className="p-3 text-right font-bold text-gray-800">{formatCurrency(t.amount)}</td>
                                       </tr>
                                   ))
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
       )}

       {/* General Ledger (GL) View */}
       {activeTab === 'gl' && (
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-[#003366] text-lg flex items-center gap-2"><Book /> General Ledger (Double Entry)</h3>
                   <button 
                        onClick={() => financeService.exportData()}
                        className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-700 flex items-center gap-1"
                   >
                       <Printer size={14} /> Export Ledger
                   </button>
               </div>
               
               <div className="space-y-4">
                   {glEntries.length === 0 ? (
                       <p className="text-center text-gray-500 py-8">No GL entries found.</p>
                   ) : (
                       glEntries.map((entry) => (
                           <div key={entry.id} className="border border-gray-200 rounded-lg overflow-hidden">
                               <div className="bg-gray-50 p-3 flex justify-between items-center text-sm">
                                   <div className="flex items-center gap-4">
                                       <span className="font-bold text-[#003366]">{new Date(entry.date).toLocaleDateString()}</span>
                                       <span className="text-gray-600">{entry.description}</span>
                                       <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">{entry.reference_type}</span>
                                   </div>
                                   <span className="font-mono text-xs text-gray-400">{entry.id.slice(0,8)}</span>
                               </div>
                               <table className="w-full text-left text-sm">
                                   <thead className="bg-white border-b border-gray-100 text-gray-500 text-xs uppercase">
                                       <tr>
                                           <th className="p-2 pl-4">Account Code</th>
                                           <th className="p-2">Description</th>
                                           <th className="p-2 text-right">Debit</th>
                                           <th className="p-2 text-right pr-4">Credit</th>
                                       </tr>
                                   </thead>
                                   <tbody>
                                       {entry.gl_lines.map((line: any) => (
                                           <tr key={line.id} className="hover:bg-gray-50/50">
                                               <td className="p-2 pl-4 font-mono text-xs text-gray-600">{line.account_code}</td>
                                               <td className="p-2 text-gray-800">{line.description}</td>
                                               <td className="p-2 text-right font-medium">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</td>
                                               <td className="p-2 text-right pr-4 font-medium">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       ))
                   )}
               </div>
           </div>
       )}

       {/* Audit Logs */}
       {activeTab === 'audit' && (
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
               <h3 className="font-bold text-[#003366] text-lg mb-4 flex items-center gap-2"><Shield /> System Audit Trail</h3>
               <div className="space-y-4">
                   {auditLogs.map((log: any, i: number) => (
                       <div key={i} className="flex gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                           <div className="text-xs font-mono text-gray-400 w-32 shrink-0">{new Date(log.timestamp).toLocaleString()}</div>
                           <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                               <Activity size={14} />
                           </div>
                           <div className="flex-1">
                               <div className="flex justify-between">
                                   <p className="text-sm font-bold text-gray-800 uppercase">{log.action} <span className="text-gray-500 font-normal">on {log.table_name}</span></p>
                                   <span className="text-xs text-gray-400 font-mono">{log.record_id}</span>
                               </div>
                               <div className="mt-1 text-xs bg-gray-50 p-2 rounded border border-gray-100 font-mono text-gray-600 overflow-x-auto">
                                   {log.action === 'UPDATE' ? (
                                       <div className="grid grid-cols-2 gap-2">
                                           <div><span className="text-red-500 font-bold">OLD:</span> {JSON.stringify(log.old_data).slice(0, 100)}...</div>
                                           <div><span className="text-green-600 font-bold">NEW:</span> {JSON.stringify(log.new_data).slice(0, 100)}...</div>
                                       </div>
                                   ) : (
                                       <span>{JSON.stringify(log.new_data || log.old_data)}</span>
                                   )}
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       )}
    </div>
  )
}
