'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platformFeeDeduction, netRunnerPayout } from '../utils/fees'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

export default function Settlement() {
  const { t } = useTranslation()
  const [amount, setAmount] = useState<number>(0)
  const deduction = platformFeeDeduction(amount)
  const net = netRunnerPayout(amount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{t('nav.settlement')}</h2>
        <Link 
          to="/invoice" 
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm text-sm font-medium"
        >
          <FileText size={16} />
          Print e-Invoice
        </Link>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <h3 className="text-lg font-medium text-gray-700">Payout Calculator</h3>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-600 w-32">{t('settlement.runnerFee')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RM</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="border border-gray-300 rounded-md pl-10 pr-4 py-2 w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-sm text-gray-500">{t('settlement.deduction')}</div>
            <div className="text-2xl font-bold text-red-600">- RM {deduction.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1">Platform Fee (5%)</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100 col-span-2">
            <div className="text-sm text-green-700">{t('settlement.netPayout')}</div>
            <div className="text-3xl font-bold text-green-700">RM {net.toFixed(2)}</div>
            <div className="text-xs text-green-600 mt-1">Ready for Disbursement</div>
          </div>
        </div>
      </div>
    </div>
  )
}