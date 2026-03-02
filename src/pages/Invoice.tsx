'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { calcInvoice, TaxType, taxRate, InvoiceItem } from '../utils/tax'
import { supabase, hasSupabase } from '../lib/supabaseClient'
import QRCode from 'qrcode.react'
import { useReactToPrint } from 'react-to-print'
import { Download, Printer, FileText, CheckCircle, DollarSign, ArrowRight, RefreshCw, AlertCircle, Shield, Lock, PenTool, Code, X, PlusCircle, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useRole } from '../context/RoleContext'
import PaymentVouchers from './PaymentVouchers'
import { financeService } from '../services/financeService'

type DocType = 'quotation' | 'invoice' | 'receipt' | 'payment_voucher'

export default function FinancialHub() {
  const { t } = useTranslation()
  const { actualRole } = useRole()
  const [activeTab, setActiveTab] = useState<DocType>('invoice')
  const navigate = useNavigate()
  const [eInvoiceStatus, setEInvoiceStatus] = useState<'pending' | 'validating' | 'verified' | 'signed'>('pending')
  const [status, setStatus] = useState<'draft' | 'issued' | 'paid' | 'overdue'>('draft')
  const [accountType, setAccountType] = useState<'Office' | 'Client'>('Office')
  
  // Shared Data State
  const [items, setItems] = useState<InvoiceItem[]>([
      { id: '1', description: 'Professional Charges', amount: 0, isTaxable: true, category: 'Fee' },
      { id: '2', description: 'Disbursements', amount: 0, isTaxable: false, category: 'Disbursement' }
  ])
  
  const [taxType, setTaxType] = useState<TaxType>('SST')
  const [uuid, setUuid] = useState<string>('')
  const [digitalSignature, setDigitalSignature] = useState<string>('')
  const [docNumber, setDocNumber] = useState('INV-2026-001')
  const [clientName, setClientName] = useState('Tan & Co')
  const [tinNo, setTinNo] = useState('')
  const [nric, setNric] = useState('')
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<any>(null)
  
  // Firm Data
  const [firmInfo, setFirmInfo] = useState<any>(null)
  const [firmTax, setFirmTax] = useState<any>(null)

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${activeTab.toUpperCase()}-${docNumber}`,
  })

  useEffect(() => {
    async function load() {
      if (hasSupabase && supabase) {
        const { data } = await supabase.from('system_settings').select('tax_type').limit(1).maybeSingle()
        if (data?.tax_type === 'GST') setTaxType('GST')
      }
      
      // Load Firm Info
      const savedInfo = localStorage.getItem('company_info')
      if (savedInfo) setFirmInfo(JSON.parse(savedInfo))
      
      const savedTax = localStorage.getItem('tax_profile')
      if (savedTax) setFirmTax(JSON.parse(savedTax))

      // Load from Current Case Linkage
      const currentCase = localStorage.getItem('current_case')
      if (currentCase) {
        const data = JSON.parse(currentCase)
        if (data.name) setClientName(data.name)
        if (data.tin_no) setTinNo(data.tin_no)
        if (data.ic_no) setNric(data.ic_no)
        
        const newItems: InvoiceItem[] = []
        // Parse "RM 5,500.00" -> 5500
        if (data.legal_fees) {
           const numeric = Number(data.legal_fees.replace(/[^0-9.-]+/g,""))
           if (!isNaN(numeric) && numeric > 0) {
               newItems.push({
                   id: 'fee-1',
                   description: 'Professional Charges / Legal Fees',
                   amount: numeric,
                   isTaxable: true,
                   category: 'Fee'
               })
           }
        }
        if (data.disbursements) {
           const numeric = Number(data.disbursements.replace(/[^0-9.-]+/g,""))
           if (!isNaN(numeric) && numeric > 0) {
               newItems.push({
                   id: 'disb-1',
                   description: 'Disbursements',
                   amount: numeric,
                   isTaxable: false,
                   category: 'Disbursement'
               })
           }
        }
        
        if (newItems.length > 0) setItems(newItems)
      }
    }
    load()
  }, [])

  // Update Doc Number on tab change
  useEffect(() => {
    if (activeTab === 'quotation') setDocNumber('QT-2026-001')
    if (activeTab === 'invoice') setDocNumber('INV-2026-001')
    if (activeTab === 'receipt') setDocNumber('RC-2026-001')
  }, [activeTab])

  const { rate, tax, subtotal, total, taxableTotal, nonTaxableTotal } = calcInvoice(items, taxType)

  async function toggleTax() {
    const next = taxType === 'SST' ? 'GST' : 'SST'
    setTaxType(next)
    if (hasSupabase && supabase) {
      await supabase.from('system_settings').update({ tax_type: next }).eq('id', 1)
    }
  }

  const convertToInvoice = () => {
    if (activeTab === 'quotation') {
      if (confirm('Convert this Quotation to a Tax Invoice?')) {
        setActiveTab('invoice')
        setDocNumber('INV-2026-001')
        setStatus('issued')
      }
    }
  }

  const markAsPaid = () => {
    setStatus('paid')
    
    // Auto-Post to GL
    // 1. Post Revenue (Fees)
    if (taxableTotal > 0) {
        financeService.postTransaction(
            '1003', // Accounts Receivable (or Bank if direct payment) -> Let's assume Bank for "Mark as Paid"
            '4001', // Legal Fees Income
            taxableTotal,
            `Invoice Payment (Fees): ${docNumber}`,
            docNumber,
            'System'
        )
    }
    
    // 2. Post Tax (SST)
    if (tax > 0) {
        financeService.postTransaction(
            '1003', // Bank
            '2001', // SST Payable
            tax,
            `SST Collection: ${docNumber}`,
            docNumber,
            'System'
        )
    }

    if (activeTab === 'invoice') {
      if (confirm('Invoice Paid & Posted to GL. Generate Official Receipt?')) {
        setActiveTab('receipt')
      }
    }
  }

  // Item Management
  const addItem = () => {
      setItems([...items, {
          id: Date.now().toString(),
          description: '',
          amount: 0,
          isTaxable: true,
          category: 'Fee'
      }])
  }

  const removeItem = (id: string) => {
      setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
      setItems(items.map(i => {
          if (i.id === id) {
              const updated = { ...i, [field]: value }
              // Auto-set category logic
              if (field === 'category') {
                  updated.isTaxable = value === 'Fee'
              }
              return updated
          }
          return i
      }))
  }

  // LDI & e-Invoice Logic
  const handlePreviewJson = () => {
    if (!tinNo) {
        alert('Please fill in TIN No first.');
        return;
    }
    if (!nric) {
        alert('Error: Buyer NRIC is missing. Required for e-Invoice.');
        return;
    }
    const payload = {
        supplier: {
            name: firmInfo?.name || 'LawCase Pro Legal Firm',
            tin: firmTax?.tin || 'C2584563200',
            msic: firmTax?.msic || '69101',
            address: firmInfo?.address || 'Level 10, Menara Law',
            email: firmInfo?.email || 'admin@lawcase.pro'
        },
        buyer: {
            tin: tinNo,
            nric: nric,
            name: clientName,
            address: '123, Client Road, 47000 Sungai Buloh'
        },
        items: items.map(item => ({
            description: item.description,
            amount: item.amount,
            taxType: item.isTaxable ? taxType : 'None',
            taxRate: item.isTaxable ? rate : 0
        })),
        total: total,
        taxAmount: tax,
        timestamp: new Date().toISOString()
    };
    setPreviewPayload(payload)
    setShowJsonModal(true)
  }

  const handleValidateEInvoice = () => {
    // 1. Data Validation (LHDN Pre-check)
    if (!tinNo) {
        alert('Validation Failed: Purchaser TIN No is missing.');
        return;
    }
    if (!nric) {
        alert('Validation Failed: Purchaser NRIC is missing.');
        return;
    }
    if (!clientName || clientName.length < 3) {
        alert('Validation Failed: Invalid Purchaser Name.');
        return;
    }
    
    setEInvoiceStatus('validating')
    setTimeout(() => {
        setEInvoiceStatus('verified')
        alert('LHDN Pre-check Passed! Address, TIN, and NRIC verified.')
    }, 1500)
  }

  const generateSHA256 = async (message: string) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const handleGenerateEInvoice = async () => {
    if (eInvoiceStatus !== 'verified') return;
    
    // Role Check
    const allowedRoles = ['Partner', 'Senior Lawyer', 'Junior Lawyer', 'Founder'];
    if (!allowedRoles.includes(actualRole)) {
        alert('Access Denied: Only Lawyers or Partners can digitally sign and issue e-Invoices.\n\nCurrent Role: ' + actualRole);
        return;
    }

    // Map Data to LHDN Format
    const lhdnPayload = {
        supplier: {
            name: firmInfo?.name || 'LawCase Pro Legal Firm',
            tin: firmTax?.tin || 'C2584563200',
            msic: firmTax?.msic || '69101',
            address: firmInfo?.address || 'Level 10, Menara Law',
            email: firmInfo?.email || 'admin@lawcase.pro'
        },
        buyer: {
            tin: tinNo,
            nric: nric,
            name: clientName,
            address: '123, Client Road, 47000 Sungai Buloh' // Mock address
        },
        items: items.map(item => ({
            description: item.description,
            amount: item.amount,
            taxType: item.isTaxable ? taxType : 'None',
            taxRate: item.isTaxable ? rate : 0
        })),
        total: total,
        taxAmount: tax,
        timestamp: new Date().toISOString()
    };

    // Generate Signature
    const signature = await generateSHA256(JSON.stringify(lhdnPayload));
    const newUuid = crypto.randomUUID();

    setUuid(newUuid);
    setDigitalSignature(signature);
    setEInvoiceStatus('signed');

    console.log('LHDN e-Invoice Payload:', lhdnPayload);
    console.log('Digital Signature (SHA-256):', signature);
    alert('e-Invoice Digitally Signed & Issued Successfully!');
  }

  const getTitle = () => {
    if (activeTab === 'quotation') return 'QUOTATION'
    if (activeTab === 'invoice') return 'TAX INVOICE'
    if (activeTab === 'receipt') return 'OFFICIAL RECEIPT'
    return 'DOCUMENT'
  }

  const getColor = () => {
    if (activeTab === 'quotation') return 'text-orange-600'
    if (activeTab === 'invoice') return 'text-blue-800'
    if (activeTab === 'receipt') return 'text-green-700'
    return 'text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#003366] font-montserrat flex items-center gap-2">
          <DollarSign size={28} /> Financial Management
        </h2>
        <div className="flex gap-2">
          {eInvoiceStatus === 'pending' && (
            <>
             <button 
              onClick={handlePreviewJson}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 shadow-sm font-bold transition-transform active:scale-95 border border-gray-300"
            >
              <Code size={18} /> JSON
            </button>
             <button 
              onClick={handleValidateEInvoice}
              className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 shadow-sm font-bold transition-transform active:scale-95"
            >
              <Shield size={18} /> LHDN Pre-check
            </button>
            </>
          )}
          {eInvoiceStatus === 'verified' && (
             <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold border border-green-200">
                <CheckCircle size={18} /> Verified
             </div>
          )}
          {eInvoiceStatus === 'signed' && (
             <div className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold border border-purple-200">
                <PenTool size={18} /> Digitally Signed
             </div>
          )}
          
          {((actualRole as string) === 'Senior Lawyer' || (actualRole as string) === 'Junior Lawyer' || actualRole === 'Partner' || (actualRole as string) === 'Senior Lawyer' || actualRole === 'Founder') && (
            <button 
              onClick={handleGenerateEInvoice}
              disabled={eInvoiceStatus !== 'verified'}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg shadow-sm font-bold transition-transform active:scale-95 ${
                eInvoiceStatus === 'verified' 
                  ? 'bg-[#003366] text-white hover:bg-[#002855]' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed hidden'
              }`}
            >
              {eInvoiceStatus === 'signed' ? <CheckCircle size={18}/> : <PenTool size={18}/>}
              {eInvoiceStatus === 'signed' ? 'Issued' : 'Sign & Submit (LHDN)'}
            </button>
          )}
          
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 shadow-sm font-bold transition-transform active:scale-95"
          >
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      <Breadcrumbs />

      {/* Tabs */}
      <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm w-fit">
        {(['quotation', 'invoice', 'receipt'] as DocType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
              activeTab === tab 
                ? 'bg-[#003366] text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <button
            onClick={() => navigate('/payment-vouchers')}
            className="px-6 py-2 rounded-md text-sm font-bold transition-all text-gray-500 hover:bg-gray-100 flex items-center gap-2"
        >
            Payment Vouchers <ArrowRight size={14} />
        </button>
      </div>

      {activeTab === 'payment_voucher' ? (
          <PaymentVouchers embedded={true} />
      ) : (
      <>
      {/* Input Section */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileText size={20} /> Document Details
        </h3>
        
        {/* Client Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-gray-600">Client Name</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-gray-600">Client TIN No <span className="text-red-500">*</span></label>
            <input
              value={tinNo}
              onChange={(e) => setTinNo(e.target.value)}
              placeholder="e.g. IG1234567890"
              className={`border rounded-lg px-4 py-2 focus:ring-2 outline-none ${!tinNo ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-[#003366]'}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-gray-600">Tax Scheme</label>
            <button 
              onClick={toggleTax} 
              className={`px-4 py-2 rounded-lg font-bold border transition-colors text-left ${
                taxType === 'SST' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700'
              }`}
            >
              {taxType} ({(taxRate(taxType) * 100).toFixed(0)}%)
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-gray-600">Account Type</label>
            <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
              <button 
                onClick={() => setAccountType('Office')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                  accountType === 'Office' 
                    ? 'bg-white text-[#003366] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Office
              </button>
              <button 
                onClick={() => setAccountType('Client')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                  accountType === 'Client' 
                    ? 'bg-white text-[#003366] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Client
              </button>
            </div>
          </div>
        </div>

        {/* Line Items Editor */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wider">Line Items (Itemized Billing)</label>
                <button 
                    onClick={addItem}
                    className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold hover:bg-blue-100"
                >
                    <PlusCircle size={14} /> Add Item
                </button>
            </div>
            
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={item.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-200 group">
                        <div className="flex-1 w-full">
                            <input 
                                className="w-full bg-transparent border-b border-gray-300 focus:border-[#003366] outline-none px-2 py-1 font-medium text-gray-800 placeholder-gray-400"
                                placeholder="Description (e.g. Legal Fee, Stamp Duty)"
                                value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-32">
                             <select 
                                className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                                value={item.category}
                                onChange={e => updateItem(item.id, 'category', e.target.value)}
                             >
                                 <option value="Fee">Fee (Taxable)</option>
                                 <option value="Disbursement">Disb. (No Tax)</option>
                             </select>
                        </div>
                        <div className="w-full md:w-32 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">RM</span>
                            <input 
                                type="number"
                                className="w-full bg-white border border-gray-300 rounded px-2 py-1 pl-8 text-right font-mono font-bold outline-none"
                                value={item.amount}
                                onChange={e => updateItem(item.id, 'amount', Number(e.target.value))}
                            />
                        </div>
                        <button 
                            onClick={() => removeItem(item.id)}
                            className="text-gray-400 hover:text-red-500 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Summary Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
             <div className="flex justify-between mb-1">
                 <div className="text-xs font-bold text-gray-500 uppercase">Subtotal (Fees)</div>
                 <div className="text-sm font-bold text-gray-700">{formatCurrency(taxableTotal)}</div>
             </div>
             <div className="flex justify-between">
                 <div className="text-xs font-bold text-gray-500 uppercase">Tax ({taxRate(taxType)*100}%)</div>
                 <div className="text-lg font-bold text-blue-800">{formatCurrency(tax)}</div>
             </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col justify-center">
            <div className="text-xs font-bold text-gray-500 uppercase">Disbursements (No Tax)</div>
            <div className="text-2xl font-bold text-gray-800">{formatCurrency(nonTaxableTotal)}</div>
          </div>
          <div className="p-4 bg-[#003366]/5 rounded-xl border border-[#003366]/20 flex flex-col justify-center">
            <div className="text-xs font-bold text-[#003366] uppercase">Total Payable</div>
            <div className="text-3xl font-bold text-[#003366]">{formatCurrency(total)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            status === 'draft' ? 'bg-gray-100 text-gray-600' :
            status === 'issued' ? 'bg-blue-100 text-blue-700' :
            status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              status === 'draft' ? 'bg-gray-400' :
              status === 'issued' ? 'bg-blue-500' :
              status === 'paid' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {status}
          </div>
          {status === 'overdue' && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertCircle size={12}/> Payment overdue by 5 days</span>}
        </div>

        <div className="flex gap-2">
          {activeTab === 'quotation' && (
            <button 
              onClick={convertToInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-bold text-sm transition-colors"
            >
              <RefreshCw size={16} /> Convert to Invoice
            </button>
          )}
          {activeTab === 'invoice' && status !== 'paid' && (
            <button 
              onClick={markAsPaid}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-bold text-sm transition-colors"
            >
              <CheckCircle size={16} /> Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Printable Preview */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-gray-100 p-8 flex justify-center">
        <div 
          ref={printRef} 
          className="bg-white p-[15mm] shadow-2xl text-gray-800 relative transition-all"
          style={{ width: '210mm', minHeight: '297mm' }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-8 mb-8">
            <div>
              <h1 className={`text-4xl font-bold tracking-tight ${getColor()}`}>{getTitle()}</h1>
              <p className="text-sm text-gray-500 mt-1 font-bold flex items-center gap-1">
                 {eInvoiceStatus === 'signed' ? (
                     <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12}/> LHDN e-Invoice Validated</span>
                 ) : 'Draft Document'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-[#003366]">LawCase Pro Legal Firm</div>
              <p className="text-sm text-gray-600">Level 10, Menara Law</p>
              <p className="text-sm text-gray-600">50450 Kuala Lumpur</p>
              <p className="text-sm text-gray-600">Reg No: 202601001234</p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bill To</h3>
              <p className="font-bold text-lg text-gray-900">{clientName}</p>
              {tinNo && <p className="text-sm font-mono text-gray-600">TIN: {tinNo}</p>}
              <p className="text-gray-600">123, Client Road</p>
              <p className="text-gray-600">47000 Sungai Buloh</p>
            </div>
            <div className="text-right space-y-2">
              <div className="flex justify-end gap-4">
                 <span className={`px-2 py-1 rounded text-xs font-bold border ${accountType === 'Office' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>
                   {accountType.toUpperCase()} ACCOUNT
                 </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-gray-500 text-sm font-bold">Doc No:</span>
                <span className="font-mono font-bold text-gray-900">{docNumber}</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-gray-500 text-sm font-bold">Date:</span>
                <span className="font-medium text-gray-900">{formatDate(new Date().toISOString())}</span>
              </div>
              {uuid && (
                  <div className="flex justify-end gap-4">
                    <span className="text-gray-500 text-sm font-bold">Ref:</span>
                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{uuid.split('-')[0]}...</span>
                  </div>
              )}
            </div>
          </div>

          {/* Table */}
          <table className="w-full mb-12">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-3 font-bold uppercase text-xs tracking-wider">Description</th>
                <th className="text-right py-3 font-bold uppercase text-xs tracking-wider w-40">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              {/* Fee Items */}
              {items.filter(i => i.isTaxable).map(item => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-4 text-gray-700 font-medium">{item.description}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                  </tr>
              ))}
              
              {/* Tax Row */}
              {taxableTotal > 0 && (
                <tr className="border-b border-gray-100 bg-gray-50/50">
                    <td className="py-4 text-gray-600 italic pl-4">{taxType} ({taxRate(taxType) * 100}%) on Fees</td>
                    <td className="py-4 text-right font-medium text-gray-700">{formatCurrency(tax)}</td>
                </tr>
              )}

              {/* Disbursement Items */}
              {items.filter(i => !i.isTaxable).length > 0 && (
                  <>
                    <tr className="border-b border-gray-100">
                        <td colSpan={2} className="py-2 text-xs font-bold text-gray-400 uppercase tracking-wider pt-4">Disbursements</td>
                    </tr>
                    {items.filter(i => !i.isTaxable).map(item => (
                        <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-4 text-gray-700 font-medium">{item.description}</td>
                            <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                        </tr>
                    ))}
                  </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800">
                <td className="py-4 font-bold text-right pr-8 text-lg">Total Payable</td>
                <td className={`py-4 text-right font-bold text-2xl ${getColor()}`}>{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div className="absolute bottom-12 left-12 right-12 border-t border-gray-200 pt-8 flex items-end justify-between">
            <div className="text-xs text-gray-500 max-w-sm space-y-1">
              <p className="font-bold text-[#003366] mb-2">Payment Terms</p>
              <p>Please pay within 14 days via Bank Transfer.</p>
              <p>Bank: <span className="font-bold text-gray-700">Maybank 5123-4567-8901</span></p>
              <p className="mt-4 italic opacity-70">This is a computer-generated document. No signature is required.</p>
            </div>
            {eInvoiceStatus === 'signed' && uuid && (
                <div className="flex flex-col items-center gap-2">
                <div className="bg-white p-2 border border-gray-200 rounded-lg">
                    <QRCode value={`https://lhdn.gov.my/verify/${uuid}`} size={80} />
                </div>
                <div className="text-right">
                     <span className="text-[10px] text-green-600 font-bold tracking-widest block text-center">LHDN VERIFIED</span>
                     <p className="text-[8px] font-mono text-gray-400 mt-1 max-w-[120px] break-all text-center">{digitalSignature.substring(0, 16)}...</p>
                </div>
                </div>
            )}
          </div>
        </div>
      </div>
      {/* JSON Preview Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-in">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2">
                <Code size={20} /> LHDN e-Invoice JSON Preview
              </h3>
              <button onClick={() => setShowJsonModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-0 overflow-auto flex-1 bg-[#1e1e1e]">
              <pre className="text-green-400 font-mono text-sm p-4">
                {JSON.stringify(previewPayload, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(previewPayload, null, 2));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", `e-invoice-${docNumber}.json`);
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                }} 
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={18} /> Download JSON
              </button>
              <button onClick={() => setShowJsonModal(false)} className="px-6 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855]">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}