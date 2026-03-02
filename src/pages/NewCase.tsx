import React, { useState, useEffect, useReducer } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Building2, FileText, CreditCard, Activity, CheckCircle, ArrowRight, Save, AlertTriangle, Calculator, Lock, UserPlus, Users, Search, Scan, Printer, Sparkles, X } from 'lucide-react';
import { lookupTIN } from '../lib/lhdn';
import SmartScanModal from '../components/SmartScanModal';
import CaseAIPanel from '../components/ai/CaseAIPanel';
import { ExtractedData } from '../services/documentAiService';

import { caseSchema, TabConfig, FieldConfig } from '../config/caseSchema';
import CaseDocumentsTab from '../components/CaseDocumentsTab';

// ... existing CaseData ...
// Extend CaseData to allow dynamic fields
interface CaseData extends Record<string, any> {
  // Keep core fields typed if needed, or rely on Record<string, any>
  id?: number;
  project_id: string;
  // ...
}

// Reducer for Form Data
const formReducer = (state: CaseData, action: { type: string; field?: string; value?: any; reset?: CaseData }) => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field!]: action.value };
    case 'RESET':
      return action.reset || ({} as CaseData);
    default:
      return state;
  }
};

export default function NewCase() {
  const { session } = useAuth();
  // Initialize form data from schema
  const initialFormData = () => {
      const data: any = {
        project_id: '',
        unit_no: '',
        file_ref: '',
        assigned_staff: '',
        purchaser_name: '',
        ic_no: '',
        contact_no: '',
        email: '',
        tin_no: '',
        correspondence_address: '',
        spa_price: 0,
        purchase_type: 'loan',
        ldi_amount: 0
      };
      
      caseSchema.forEach(tab => {
          tab.fields.forEach(field => {
              if (data[field.key] === undefined) {
                  data[field.key] = field.type === 'number' ? 0 : '';
              }
          });
      });
      return data;
  };

  const [formData, dispatch] = useReducer(formReducer, {} as any, initialFormData);

  const { id } = useParams();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('basic'); // Changed type to string to match schema
  const [projects, setProjects] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
      // Load Projects for Dropdown
      const fetchProjects = async () => {
          const { data } = await supabase.from('projects').select('id, name');
          if (data) {
              setProjects(data);
          } else {
              // Mock if no DB connection or empty
              setProjects([{ id: '1', name: 'Eco Majestic' }, { id: '2', name: 'Setia Alam' }]);
          }
      };
      fetchProjects();
  }, []);
  
  // Auto-Sum Logic
  const calculateTotal = (tabId: string) => {
      const tab = caseSchema.find(t => t.id === tabId);
      if (!tab) return 0;
      
      let total = 0;
      tab.fields.forEach(field => {
          if (field.autoSum) {
              total += Number(formData[field.key] || 0);
          }
      });
      return total;
  };

  const handlePrintDoc = (fieldKey: string, value: string) => {
      if (!value) {
          alert('Please select a date first.');
          return;
      }
      // Trigger document generation based on field key
      // Mock logic: navigate to Master Document with context or open modal
      // For now, simple alert or console log as per "logic trigger" requirement
      console.log(`Generating document for ${fieldKey} with date ${value}`);
      
      // In a real scenario, this would likely open a specific template
      // e.g. Acting Letter Template if key is 'acting_letter_dated'
      if (fieldKey === 'acting_letter_dated') {
          // Trigger Document Generation
          // In a real app, this might open a modal or redirect
          // We will simulate the logic trigger as requested
          if (confirm(`Generate Acting Letter for date ${value}?`)) {
              // Simulate API call or navigation
              console.log('Document Generation Triggered: Acting Letter');
              alert(`Success: Acting Letter generated for date ${value}`);
          }
      } else {
          alert(`Document generated for ${fieldKey}`);
      }
  };

  const handleSave = async (close: boolean) => {
      try {
          // Basic validation
          if (!formData.project_id) {
              alert('Please select a project');
              return;
          }

          const endpoint = id ? `/api/cases/update?id=${id}` : '/api/cases/create';
          const method = id ? 'PUT' : 'POST';
          const body = id ? { id, ...formData } : formData;

          const response = await fetch(endpoint, {
              method,
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify(body)
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to save case');
          }

          if (close) {
              navigate('/cases');
          } else {
              // Just save, maybe show toast
              console.log('Saved successfully');
          }
      } catch (err: any) {
          console.error('Error saving case:', err);
          alert(err.message || 'Failed to save case. See console for details.');
      }
  };

  const handleSaveAndNext = async () => {
      // Basic validation if needed
      await handleSave(false);
      
      const currentIndex = caseSchema.findIndex(t => t.id === activeTab);
      if (currentIndex < caseSchema.length - 1) {
          setActiveTab(caseSchema[currentIndex + 1].id);
          // Scroll to top
          const contentArea = document.querySelector('.overflow-y-auto');
          if (contentArea) contentArea.scrollTop = 0;
      } else {
          alert('All tabs completed!');
      }
  };

  // Render Field Helper
  const renderField = (field: FieldConfig) => {
      const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
      
      return (
          <div key={field.key} className={`${colSpanClass} relative`}>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-2">
                  {field.type === 'textarea' ? (
                      <textarea
                          rows={3}
                          value={formData[field.key] || ''}
                          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: field.key, value: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                      />
                  ) : field.type === 'select' ? (
                      <select
                          value={formData[field.key] || ''}
                          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: field.key, value: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                      >
                          <option value="">-- Select --</option>
                          {field.key === 'project_id' 
                              ? projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                              : field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
                          }
                      </select>
                  ) : (
                      <input
                          type={field.type}
                          value={formData[field.key] || ''}
                          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: field.key, value: field.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none"
                      />
                  )}
                  
                  {/* Printer Button Logic */}
                  {field.hasPrinter && (
                      <button
                          onClick={() => handlePrintDoc(field.key, formData[field.key])}
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 text-gray-600"
                          title="Generate Document"
                      >
                          <Printer size={18} />
                      </button>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{id ? 'Edit Case' : 'New Case'}</h1>
              <p className="text-sm text-gray-500">Fill in the details below to manage this file.</p>
            </div>
            <button 
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition-colors ${showAIPanel ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
            >
              <Sparkles className={`h-4 w-4 ${showAIPanel ? 'text-indigo-600' : 'text-gray-400'}`} />
              {showAIPanel ? 'Hide AI Panel' : 'AI Assistant'}
            </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          {/* Vertical Tabs (Desktop) / Horizontal (Mobile) */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto md:h-auto">
            <nav className="flex md:flex-col overflow-x-auto md:overflow-visible">
              {caseSchema.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap py-3 px-4 border-l-4 text-left font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-[#003366] bg-white text-[#003366] font-bold shadow-sm'
                      : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto">
             {caseSchema.map((tab) => {
                 if (tab.id !== activeTab) return null;
                 
                 // Render Custom Documents Tab
                 if (tab.id === 'documents') {
                     return (
                         <div key={tab.id} className="animate-fade-in">
                             <CaseDocumentsTab caseId={id} />
                         </div>
                     )
                 }

                 const total = (tab.id === 'spa_fees' || tab.id === 'loan_fees') ? calculateTotal(tab.id) : null;

                 return (
                     <div key={tab.id} className="animate-fade-in">
                         <h3 className="text-xl font-bold text-[#003366] mb-6 border-b pb-2 flex justify-between items-center">
                             {tab.label}
                             {total !== null && (
                                 <span className="text-lg bg-green-100 text-green-800 px-3 py-1 rounded-lg">
                                     Total: RM {total.toFixed(2)}
                                 </span>
                             )}
                         </h3>
                         
                         {/* 2-Column Grid */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {tab.fields.map(field => renderField(field))}
                         </div>

                         {/* Special Logic for Basic Tab (Verify TIN button etc) */}
                         {tab.id === 'basic' && (
                             <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                                 <p className="font-bold">Tip:</p>
                                 <p>Use the Verify TIN button next to IC No to fetch tax details from LHDN.</p>
                             </div>
                         )}
                     </div>
                 );
             })}

             {/* Action Buttons Footer (inside content area or sticky) */}
             <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-4">
                 <button onClick={() => navigate('/cases')} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 font-medium">Cancel</button>
                 <button onClick={handleSaveAndNext} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm flex items-center gap-2">
                     Save & Next <ArrowRight size={16} />
                 </button>
                 <button onClick={() => handleSave(true)} className="px-6 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002855] font-bold shadow-lg flex items-center gap-2">
                     <Save size={16} /> Save & Close
                 </button>
             </div>
          </div>

          {/* AI Panel */}
          {showAIPanel && (
             <div className="hidden md:block">
                 <CaseAIPanel 
                    caseId={id} 
                    caseData={formData} 
                    onAccept={(analysis) => {
                        console.log('Accepted AI Analysis:', analysis);
                        // In a real implementation, we would update formData here
                        // dispatch({ type: 'MERGE_DATA', value: analysis });
                    }}
                 />
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
