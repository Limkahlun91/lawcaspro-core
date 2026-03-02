'use client'

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bot, FileText, DollarSign, Shield, ArrowRight, BrainCircuit } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';

export default function SmartEngine() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<'will' | 'finance' | 'docs' | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight flex items-center gap-2">
            <BrainCircuit size={32} className="text-purple-600" /> Smart Engine 3.0
          </h2>
          <p className="text-gray-500 text-sm mt-1">AI-Powered Legal & Financial Intelligence.</p>
        </div>
      </div>

      <Breadcrumbs />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* AI Will Auditor */}
        <div 
            onClick={() => navigate('/documents')}
            className="bg-white p-6 rounded-xl shadow-md border border-purple-100 hover:shadow-xl transition-all cursor-pointer group"
        >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">AI Will Auditor</h3>
            <p className="text-gray-500 text-sm mb-4">
                Automated conflict checks for Beneficiaries & Witnesses. Guardian logic for minors.
            </p>
            <span className="text-purple-600 font-bold text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Launch Auditor <ArrowRight size={16} />
            </span>
        </div>

        {/* Financial AI Assistant */}
        <div 
            onClick={() => navigate('/invoice')} // Or Knowledge Hub / Finance Hub
            className="bg-white p-6 rounded-xl shadow-md border border-green-100 hover:shadow-xl transition-all cursor-pointer group"
        >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                <DollarSign size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">Financial AI Assistant</h3>
            <p className="text-gray-500 text-sm mb-4">
                Tax exemption checker (Petrol, Phone) & Statutory contribution logic (EPF/SOCSO).
            </p>
            <span className="text-green-600 font-bold text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Open Finance Hub <ArrowRight size={16} />
            </span>
        </div>

        {/* Master Document Engine */}
        <div 
            onClick={() => navigate('/documents')}
            className="bg-white p-6 rounded-xl shadow-md border border-blue-100 hover:shadow-xl transition-all cursor-pointer group"
        >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">Master Document Engine</h3>
            <p className="text-gray-500 text-sm mb-4">
                Smart variable mapping, bank document generation (LO/Advice), and legal letters.
            </p>
            <span className="text-blue-600 font-bold text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Go to Engine <ArrowRight size={16} />
            </span>
        </div>
      </div>

      {/* AI Status Panel */}
      <div className="bg-gradient-to-r from-gray-900 to-[#003366] rounded-xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">AI Core Status: <span className="text-green-400">ONLINE</span></h3>
              <p className="text-blue-200 mb-6 max-w-2xl">
                  The Smart Engine is actively monitoring compliance rules across Will Writing, Conveyancing, and Taxation modules. 
                  Knowledge Base last updated: Today.
              </p>
              <div className="flex gap-4">
                  <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                      <span className="block text-xs text-blue-300 uppercase">LHDN Rules</span>
                      <span className="font-bold">v2.0 Synced</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                      <span className="block text-xs text-blue-300 uppercase">Bar Council</span>
                      <span className="font-bold">Solicitor Act</span>
                  </div>
              </div>
          </div>
          <Bot size={200} className="absolute -right-10 -bottom-10 text-white/5 rotate-12" />
      </div>
    </div>
  );
}