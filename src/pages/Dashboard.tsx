'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { supabase, hasSupabase } from '../lib/supabaseClient'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import { DollarSign, TrendingUp, Users, AlertTriangle, Lock, ShieldCheck, FileCheck } from 'lucide-react'
import SecurityModal from '../components/SecurityModal'

ChartJS.register(BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

type Row = { state: string; revenue: number }
type TaxType = 'SST' | 'GST'

export default function Dashboard() {
  const { t } = useTranslation()
  const { actualRole } = useRole()
  const { firmSettings } = useAuth()
  const [rows, setRows] = useState<Row[]> ([
    { state: 'Johor', revenue: 1200 },
    { state: 'Selangor', revenue: 1800 },
    { state: 'Penang', revenue: 900 },
  ])
  const [taxType, setTaxType] = useState<TaxType>('SST')
  
  // Privacy State
  const [showSensitiveData, setShowSensitiveData] = useState(true)
  const [showSecurityModal, setShowSecurityModal] = useState(false)

  // Mock monthly data (Profit Curve)
  const monthlyData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Collected Revenue',
        data: [12000, 19000, 15000, 22000, 28000, 35000],
        borderColor: '#10b981', // Green for Money In
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Paid PV Expenses',
        data: [8000, 12000, 10000, 14000, 16000, 18000],
        borderColor: '#ef4444', // Red for Money Out
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  }

  // Mock Revenue Composition (Fees vs Disbursements)
  const revenueCompData = {
    labels: ['Professional Fees', 'Disbursements', 'Processing Fees'],
    datasets: [
      {
        label: 'Revenue Composition',
        data: [85000, 32000, 14000],
        backgroundColor: ['#003366', '#3b82f6', '#93c5fd'],
        borderWidth: 0
      }
    ]
  }

  // Mock Cash Flow (Billed vs Collected)
  const cashFlowData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Billed (Invoiced)',
        data: [15000, 22000, 18000, 25000, 30000, 38000],
        backgroundColor: '#93c5fd',
        borderRadius: 4
      },
      {
        label: 'Collected (Actual)',
        data: [12000, 19000, 15000, 22000, 28000, 35000],
        backgroundColor: '#003366',
        borderRadius: 4
      }
    ]
  }
  
  // Mock Employee Performance
  const employeeData = {
    labels: ['Sarah', 'Mike', 'Jessica', 'David', 'Emily'],
    datasets: [
      {
        label: 'Cases Handled',
        data: [12, 19, 8, 15, 10],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: '#3b82f6',
        borderWidth: 1
      },
      {
        label: 'Tasks Completed',
        data: [45, 60, 30, 55, 40],
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: '#10b981',
        borderWidth: 1
      }
    ]
  }

  // Mock Aging Report Data
  const agingData = {
    labels: ['1-30 Days', '31-60 Days', '60-90 Days', '> 90 Days'],
    datasets: [
      {
        label: 'Unpaid Amount',
        data: [25000, 15000, 8000, 2200],
        backgroundColor: ['#4ade80', '#facc15', '#fb923c', '#ef4444'],
        borderWidth: 0
      }
    ]
  }

  // LDI State
  const [deadlines, setDeadlines] = useState<any[]>([])
  // LDI State
  const [ldiCases, setLdiCases] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      // 0. Founder Mode Bypass & Privacy Lock - BASED ON FIRM POLICY
      const isFounder = actualRole === 'Founder' || localStorage.getItem('is_founder_logged_in') === 'true'
      const pinRequired = firmSettings?.founder_pin_required ?? true // Default true for safety
      
      if (isFounder && pinRequired) {
        setShowSensitiveData(false) // Lock by default for Founder if PIN required
        
        // Use Mock Data for Founder Mode to avoid 401
        setRows([
          { state: 'Johor', revenue: 5500 },
          { state: 'Selangor', revenue: 8200 },
          { state: 'Penang', revenue: 3100 },
          { state: 'Kuala Lumpur', revenue: 12000 }
        ])
        // Mock Deadlines
        setDeadlines([
           { title: 'SPA Stamping (Founder Test)', due: '2026-03-01', daysLeft: 5, priority: 'high' },
           { title: 'Loan Documentation', due: '2026-03-15', daysLeft: 19, priority: 'medium' }
        ])
        // Mock LDI
        setLdiCases([
            { id: 99, purchaser_name: 'Mock LDI Case', ldi_amount: 1500.50, unit_no: 'A-10-10' }
        ])
        return
      } else if (isFounder && !pinRequired) {
          // Internal Dev / No PIN required -> Show Data
          setShowSensitiveData(true)
      }

      if (!hasSupabase || !supabase) return
      const { data, error } = await supabase
        .from('state_profit')
        .select('state,revenue')
      if (!error && data) setRows(data as Row[])
      
      const { data: settings } = await supabase.from('system_settings').select('tax_type').limit(1).maybeSingle()
      if (settings?.tax_type) setTaxType(settings.tax_type as TaxType)

      // Fetch LDI Cases
      const { data: ldiData } = await supabase
        .from('cases')
        .select('id, purchaser_name, unit_no, ldi_amount')
        .gt('ldi_amount', 0)
        .limit(5);
      
      if (ldiData) setLdiCases(ldiData);

      // Deadline Engine Calculation
      const storedCase = localStorage.getItem('current_case')
      const deadlineList = []
      if (storedCase) {
        try {
          const c = JSON.parse(storedCase)
          // 1. SPA Stamping Deadline (30 days from Executed Date)
          if (c.spa_executed_date) {
            const execDate = new Date(c.spa_executed_date)
            if (!isNaN(execDate.getTime())) {
              const due = new Date(execDate)
              due.setDate(due.getDate() + 30)
              const diff = Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              deadlineList.push({
                title: 'SPA Stamping Deadline',
                due: due.toLocaleDateString('en-MY'),
                daysLeft: diff,
                priority: diff < 7 ? 'high' : 'medium'
              })
            }
          
            // 3. Completion Deadline (36 Months from Project First SPA Date or Case SPA Date)
            // Priority: Project First SPA Date > Case SPA Date
            const baseDateStr = c.project_first_spa_date || c.spa_executed_date
            const baseDate = new Date(baseDateStr)
            
            if (!isNaN(baseDate.getTime())) {
                const completion = new Date(baseDate)
                completion.setMonth(completion.getMonth() + 36) // Schedule H: 36 Months
                const diffComp = Math.ceil((completion.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                
                deadlineList.push({
                  title: 'Completion Deadline (36 Months)',
                  due: completion.toLocaleDateString('en-MY'),
                  daysLeft: diffComp,
                  priority: diffComp < 60 ? 'high' : 'medium'
                })

                // 4. Extended Completion (+1 Month)
                const extended = new Date(completion)
                extended.setMonth(extended.getMonth() + 1)
                const diffExt = Math.ceil((extended.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                if (diffComp < 0 && diffExt > 0) {
                   deadlineList.push({
                    title: 'Extended Completion Period',
                    due: extended.toLocaleDateString('en-MY'),
                    daysLeft: diffExt,
                    priority: 'high'
                  })
                }
            }
          }
          
          // 2. Loan Documentation (14 days from Approval)
          if (c.loan_approved_date) {
            const appDate = new Date(c.loan_approved_date)
            if (!isNaN(appDate.getTime())) {
              const due = new Date(appDate)
              due.setDate(due.getDate() + 14)
              const diff = Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              deadlineList.push({
                title: 'Loan Documentation Deadline',
                due: due.toLocaleDateString('en-MY'),
                daysLeft: diff,
                priority: diff < 3 ? 'high' : 'medium'
              })
            }
          }
        } catch (e) {
          console.error('Failed to parse current_case', e)
        }
      }
      
      // Add mock deadlines if empty
      if (deadlineList.length === 0) {
        const today = new Date()
        const d1 = new Date(today)
        d1.setDate(today.getDate() + 5)
        const d2 = new Date(today)
        d2.setDate(today.getDate() + 18)

        deadlineList.push({ title: 'SPA Stamping (Mock Case)', due: d1.toLocaleDateString('en-MY'), daysLeft: 5, priority: 'high' })
        deadlineList.push({ title: 'Loan Documentation (Mock Case)', due: d2.toLocaleDateString('en-MY'), daysLeft: 18, priority: 'medium' })
      }
      setDeadlines(deadlineList)
    }
    load()
  }, [actualRole, firmSettings])

  const toggleTax = async () => {
    const next = taxType === 'SST' ? 'GST' : 'SST'
    setTaxType(next)
    if (hasSupabase && supabase) {
      await supabase.from('system_settings').update({ tax_type: next }).eq('id', 1) // Assuming single row
    }
  }

  const data = {
    labels: rows.map((r) => t(`dashboard.${r.state.toLowerCase()}`) || r.state),
    datasets: [
      {
        label: t('dashboard.platformFee'),
        data: rows.map((r) => r.revenue),
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#1d4ed8'
      },
    ],
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      <SecurityModal 
          isOpen={showSecurityModal}
          onClose={() => setShowSecurityModal(false)}
          onSuccess={() => { setShowSecurityModal(false); setShowSensitiveData(true); }}
          title="Restricted Financial Access"
          message="Founder Authorization Required. Enter PIN to view financial insights."
      />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">{t('nav.dashboard')}</h2>
        {actualRole === 'Founder' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-xl border border-yellow-200 shadow-sm">
              <span className="text-sm font-bold text-yellow-800 uppercase tracking-wide">Founder Control</span>
              <button 
                onClick={toggleTax}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  taxType === 'SST' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                Tax Mode: {taxType}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards (Financial Top) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-green-50 text-green-600 rounded-xl">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Revenue</p>
            <p className="text-2xl font-bold text-[#003366]">RM 131,000</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-red-50 text-red-600 rounded-xl">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">RM 45,200</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Cases</p>
            <p className="text-2xl font-bold text-[#003366]">24</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-xl">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Staff</p>
            <p className="text-2xl font-bold text-[#003366]">12</p>
          </div>
        </div>
      </div>

      {/* Sensitive Financial Block (Protected) */}
      <div className="relative">
        {!showSensitiveData && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl border border-gray-200 shadow-sm">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-gray-100 max-w-md">
                    <div className="bg-red-50 p-4 rounded-full w-fit mx-auto mb-4 text-red-600">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Restricted Financial Data</h3>
                    <p className="text-gray-500 mb-6">Sensitive profit curves and tax compliance data are hidden for privacy.</p>
                    <button 
                        onClick={() => setShowSecurityModal(true)}
                        className="bg-[#003366] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#002855] transition-colors w-full"
                    >
                        Unlock with Founder PIN
                    </button>
                </div>
             </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${!showSensitiveData ? 'blur-sm select-none pointer-events-none' : ''}`}>
            {/* Profit Curve */}
            <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                    <TrendingUp className="text-green-600" /> Real-time Profit Board
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Revenue vs Expenses (Live)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase">Net Profit (YTD)</p>
                  <p className="text-2xl font-bold text-green-600">RM 45,200.00</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <Line data={monthlyData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => `RM ${c.raw}` } }
                  },
                  scales: { 
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { callback: (v) => 'RM ' + v } },
                    x: { grid: { display: false } }
                  },
                  interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }} />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
                 <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">Total Revenue</p>
                    <p className="text-lg font-bold text-[#003366]">RM 131,000</p>
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">Total Expenses</p>
                    <p className="text-lg font-bold text-red-500">RM 80,000</p>
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">Est. Tax (SST)</p>
                    <p className="text-lg font-bold text-purple-600">RM 5,800</p>
                 </div>
              </div>
            </div>
            
            {/* Tax Compliance & Aging Stats */}
            <div className="space-y-6 flex flex-col h-full">
                {/* SST Tracker */}
                <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden">
                    <h3 className="text-sm font-bold text-purple-700 uppercase mb-4 flex items-center gap-2">
                        <ShieldCheck size={16} /> SST Tracker
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Professional Fees (Taxable)</span>
                            <span className="font-bold text-[#003366]">RM 85,000</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Disbursements (Non-Tax)</span>
                            <span className="font-bold text-gray-500">RM 15,000</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: '15%' }}></div>
                        </div>
                        <div className="pt-2 mt-2 border-t border-dashed border-purple-200 flex justify-between items-center">
                            <span className="font-bold text-purple-700">SST Payable (8%)</span>
                            <span className="font-bold text-xl text-purple-700">RM 6,800</span>
                        </div>
                    </div>
                </div>

                {/* Aging Report */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-orange-500" /> Aging Report (Unpaid)
                    </h3>
                    <div className="flex-1 min-h-[150px]">
                        <Doughnut data={agingData} options={{
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
                            }
                        }} />
                    </div>
                    <button className="mt-4 w-full py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs hover:bg-red-100 flex items-center justify-center gap-2 transition-colors">
                        <AlertTriangle size={12} /> Remind All Overdue (3)
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Operational Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* LDI Alerts Block */}
        <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden h-full">
            <h3 className="text-sm font-bold text-orange-700 uppercase mb-4 flex items-center gap-2">
                <AlertTriangle size={16} /> LDI Penalty Alerts
            </h3>
            <div className="space-y-3 relative z-10">
                {ldiCases.length === 0 ? <p className="text-sm text-gray-400">No active LDI penalties.</p> : ldiCases.map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-orange-50/50 rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors">
                        <div className="flex-1 min-w-0 pr-2">
                            <p className="text-gray-800 font-bold text-sm truncate" title={c.purchaser_name}>{c.purchaser_name}</p>
                            <p className="text-xs text-gray-500 font-mono">Unit: {c.unit_no}</p>
                        </div>
                        <span className="text-sm font-bold text-red-600">
                            RM {c.ldi_amount.toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* Urgent Deadlines */}
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden h-full">
            <h3 className="text-sm font-bold text-red-700 uppercase mb-4 flex items-center gap-2">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </span>
               Urgent Deadlines
            </h3>
            <div className="space-y-3 relative z-10">
              {deadlines.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No urgent deadlines.</p>
              ) : (
                  deadlines.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100 hover:bg-red-50 transition-colors">
                      <div className="flex-1 min-w-0 pr-2">
                          <p className="text-gray-800 font-bold text-sm truncate" title={d.title}>{d.title}</p>
                          <p className="text-xs text-red-500 font-medium">Due: {d.due}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm ${d.daysLeft < 7 ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                        {d.daysLeft} Days
                      </span>
                    </div>
                  ))
              )}
            </div>
        </div>
        
        {/* State Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-sm font-bold text-[#003366] uppercase mb-4">Revenue by State</h3>
            <div className="h-[200px]">
                <Bar data={data} options={{
                    maintainAspectRatio: false,
                    scales: { y: { grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
                }} />
            </div>
        </div>
      </div>
    </div>
  )
}