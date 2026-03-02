import { useState, useEffect } from 'react'
import { Plus, Search, Map, Calendar, Building, FileText, X, Save, Edit, Trash2, Landmark, List } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'

type MasterChargee = {
  bank_name: string
  registration_no: string
  bank_address: string
  presentation_no: string
  presentation_date: string
}

type PropertyType = {
    id: number
    type: string
    units: number
}

type Project = {
  id: number
  developer_id: number
  name: string
  phase: string
  
  // Land & Location
  location: string
  lot_no: string
  title_number: string // Manual Input
  mukim: string // NEW
  daerah: string // NEW
  negeri: string // NEW
  land_size: string
  
  // Licenses
  license_no: string // DL
  dl_start_date: string // NEW
  dl_expired_date: string // NEW
  
  ap_no: string // Renamed from apdl_no
  ap_start_date: string // NEW
  ap_expired_date: string // NEW
  
  layout_plan_approval: string
  layout_plan_approval_date: string // NEW
  
  building_plan_approval_ref: string // NEW
  building_plan_approval_date: string // NEW
  
  // Timeline
  first_spa_date: string
  launch_date: string
  est_completion: string
  
  // Units
  units_total: number
  units_sold: number
  property_types: PropertyType[] // NEW
  
  // Master Chargee
  master_chargee?: MasterChargee
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [developers, setDevelopers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProj, setEditingProj] = useState<Project | null>(null)

  const initialForm: Partial<Project> = {
    name: '',
    phase: '',
    location: '',
    lot_no: '',
    title_number: '', // Manual
    mukim: '',
    daerah: '',
    negeri: '',
    land_size: '',
    license_no: '',
    dl_start_date: '',
    dl_expired_date: '',
    ap_no: '',
    ap_start_date: '',
    ap_expired_date: '',
    layout_plan_approval: '',
    layout_plan_approval_date: '',
    building_plan_approval_ref: '',
    building_plan_approval_date: '',
    first_spa_date: '',
    launch_date: '',
    est_completion: '',
    units_total: 0,
    property_types: [],
    master_chargee: {
      bank_name: '',
      registration_no: '',
      bank_address: '',
      presentation_no: '',
      presentation_date: ''
    }
  }

  const [formData, setFormData] = useState<Partial<Project>>(initialForm)

  useEffect(() => {
    const storedProjs = localStorage.getItem('projects')
    if (storedProjs) setProjects(JSON.parse(storedProjs))
    
    const storedDevs = localStorage.getItem('developers')
    if (storedDevs) setDevelopers(JSON.parse(storedDevs))
  }, [])

  // Auto-calculate Completion Date based on First SPA Date
  useEffect(() => {
    if (formData.first_spa_date) {
      const spaDate = new Date(formData.first_spa_date)
      if (!isNaN(spaDate.getTime())) {
        // Standard 36 months for Schedule H
        const completionDate = new Date(spaDate)
        completionDate.setMonth(completionDate.getMonth() + 36)
        setFormData(prev => ({ ...prev, est_completion: completionDate.toISOString().split('T')[0] }))
      }
    }
  }, [formData.first_spa_date])

  // Auto-calculate Total Units from Property Types
  useEffect(() => {
      if (formData.property_types && formData.property_types.length > 0) {
          const total = formData.property_types.reduce((sum, pt) => sum + (Number(pt.units) || 0), 0)
          setFormData(prev => ({ ...prev, units_total: total }))
      }
  }, [formData.property_types])

  const handleSave = () => {
    if (!formData.name || !formData.developer_id) return alert('Project Name and Developer are required')
    // Validation for new fields could go here

    let updatedProjs
    if (editingProj) {
      updatedProjs = projects.map(p => p.id === editingProj.id ? { ...p, ...formData } as Project : p)
    } else {
      const newProj: Project = {
        ...formData,
        id: Date.now(),
        units_sold: 0
      } as Project
      updatedProjs = [...projects, newProj]
    }

    setProjects(updatedProjs)
    localStorage.setItem('projects', JSON.stringify(updatedProjs))
    setShowModal(false)
    setEditingProj(null)
    setFormData(initialForm)
  }

  const handleEdit = (proj: Project) => {
    setEditingProj(proj)
    // Ensure nested objects exist
    const safeProj = {
        ...proj,
        master_chargee: proj.master_chargee || { bank_name: '', registration_no: '', bank_address: '', presentation_no: '', presentation_date: '' },
        property_types: proj.property_types || []
    }
    setFormData(safeProj)
    setShowModal(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Delete this project?')) {
      const updated = projects.filter(p => p.id !== id)
      setProjects(updated)
      localStorage.setItem('projects', JSON.stringify(updated))
    }
  }

  // Property Type Handlers
  const addPropertyType = () => {
      setFormData(prev => ({
          ...prev,
          property_types: [...(prev.property_types || []), { id: Date.now(), type: '', units: 0 }]
      }))
  }

  const removePropertyType = (id: number) => {
      setFormData(prev => ({
          ...prev,
          property_types: (prev.property_types || []).filter(pt => pt.id !== id)
      }))
  }

  const updatePropertyType = (id: number, field: keyof PropertyType, value: string | number) => {
      setFormData(prev => ({
          ...prev,
          property_types: (prev.property_types || []).map(pt => pt.id === id ? { ...pt, [field]: value } : pt)
      }))
  }

  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none text-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Project Registry</h2>
          <p className="text-gray-500 text-sm mt-1">Manage housing development projects and compliance details.</p>
        </div>
        <button 
          onClick={() => {
            setEditingProj(null)
            setFormData(initialForm)
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
        >
          <Plus size={18} /> New Project
        </button>
      </div>

      <Breadcrumbs />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <Search className="text-gray-400" size={20} />
        <input 
          className="flex-1 outline-none text-gray-700"
          placeholder="Search project name or location..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(proj => (
          <div key={proj.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 relative group">
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => handleEdit(proj)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
               <button onClick={() => handleDelete(proj.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
             </div>
             
             <div className="mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  {developers.find(d => d.id === Number(proj.developer_id))?.name || 'Unknown Developer'}
                </span>
                <h3 className="font-bold text-xl text-[#003366] mt-1">{proj.name}, Phase {proj.phase}</h3>
                <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                   <Map size={14} /> {proj.location}
                </div>
             </div>

             <div className="space-y-3 border-t border-gray-100 pt-4">
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">DL No:</span>
                 <span className="font-mono font-medium">{proj.license_no || '-'}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">AP No:</span>
                 <span className="font-mono font-medium">{proj.ap_no || '-'}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">Master Chargee:</span>
                 <span className="font-medium truncate max-w-[150px]">{proj.master_chargee?.bank_name || 'N/A'}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">Completion:</span>
                 <span className={`font-bold ${new Date(proj.est_completion) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                   {proj.est_completion || 'TBA'}
                 </span>
               </div>
             </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                {editingProj ? <Edit size={20} /> : <Plus size={20} />}
                {editingProj ? 'Edit Project' : 'New Project'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              
              {/* 1. Project Identity */}
              <section>
                <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2 border-b pb-2"><Building size={18}/> Project Identity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                     <label className="block text-sm font-bold text-gray-700 mb-1">Developer <span className="text-red-500">*</span></label>
                     <select className={inputClass} value={formData.developer_id} onChange={e => setFormData({...formData, developer_id: Number(e.target.value)})}>
                       <option value="">-- Select Developer --</option>
                       {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                    <input className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Eco Majestic" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Phase</label>
                    <input className={inputClass} value={formData.phase} onChange={e => setFormData({...formData, phase: e.target.value})} placeholder="e.g. Phase 2A" />
                  </div>
                </div>
              </section>

              {/* 2. Land & Location */}
              <section>
                 <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2 border-b pb-2"><Map size={18}/> Land & Location</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                       <label className="block text-sm font-bold text-gray-700 mb-1">Project Location</label>
                       <input className={inputClass} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:col-span-2">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Title No (Manual)</label>
                            <input className={inputClass} value={formData.title_number} onChange={e => setFormData({...formData, title_number: e.target.value})} placeholder="e.g. HS(D) 1234" />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">Lot No</label>
                             <input className={inputClass} value={formData.lot_no} onChange={e => setFormData({...formData, lot_no: e.target.value})} placeholder="Lot 12345" />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">Land Size</label>
                             <input className={inputClass} value={formData.land_size} onChange={e => setFormData({...formData, land_size: e.target.value})} placeholder="e.g. 10 Acres" />
                        </div>
                    </div>
                    {/* New Location Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Mukim (District) <span className="text-red-500">*</span></label>
                            <input className={inputClass} value={formData.mukim} onChange={e => setFormData({...formData, mukim: e.target.value})} placeholder="e.g. Mukim Plentong" />
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Daerah (County) <span className="text-red-500">*</span></label>
                            <input className={inputClass} value={formData.daerah} onChange={e => setFormData({...formData, daerah: e.target.value})} placeholder="e.g. Johor Bahru" />
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Negeri (State) <span className="text-red-500">*</span></label>
                            <input className={inputClass} value={formData.negeri} onChange={e => setFormData({...formData, negeri: e.target.value})} placeholder="e.g. Johor" />
                         </div>
                    </div>
                 </div>
              </section>

              {/* 3. Compliance & Licenses */}
              <section>
                 <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2 border-b pb-2"><FileText size={18}/> Compliance & Licenses</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                       <label className="block text-sm font-bold text-gray-700 mb-1">Developer License (DL)</label>
                       <input className={inputClass} value={formData.license_no} onChange={e => setFormData({...formData, license_no: e.target.value})} placeholder="DL Number" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">DL Start Date</label>
                       <input type="date" className={inputClass} value={formData.dl_start_date} onChange={e => setFormData({...formData, dl_start_date: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">DL Expired Date</label>
                       <input type="date" className={inputClass} value={formData.dl_expired_date} onChange={e => setFormData({...formData, dl_expired_date: e.target.value})} />
                    </div>

                    <div className="md:col-span-1">
                       <label className="block text-sm font-bold text-gray-700 mb-1">AP No (Advertising Permit)</label>
                       <input className={inputClass} value={formData.ap_no} onChange={e => setFormData({...formData, ap_no: e.target.value})} placeholder="AP Number" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">AP Start Date</label>
                       <input type="date" className={inputClass} value={formData.ap_start_date} onChange={e => setFormData({...formData, ap_start_date: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">AP Expired Date</label>
                       <input type="date" className={inputClass} value={formData.ap_expired_date} onChange={e => setFormData({...formData, ap_expired_date: e.target.value})} />
                    </div>

                    <div className="md:col-span-2">
                       <label className="block text-sm font-bold text-gray-700 mb-1">Layout Plan Approval</label>
                       <input className={inputClass} value={formData.layout_plan_approval} onChange={e => setFormData({...formData, layout_plan_approval: e.target.value})} placeholder="Approval Ref No." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Approval Date</label>
                        <input type="date" className={inputClass} value={formData.layout_plan_approval_date} onChange={e => setFormData({...formData, layout_plan_approval_date: e.target.value})} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Building Plan Approval</label>
                        <input className={inputClass} value={formData.building_plan_approval_ref} onChange={e => setFormData({...formData, building_plan_approval_ref: e.target.value})} placeholder="Building Plan Ref No." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Approval Date</label>
                        <input type="date" className={inputClass} value={formData.building_plan_approval_date} onChange={e => setFormData({...formData, building_plan_approval_date: e.target.value})} />
                    </div>
                 </div>
              </section>

              {/* 4. Project Timeline */}
              <section>
                 <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={18}/> Project Timeline</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">First SPA Date</label>
                       <input type="date" className={inputClass} value={formData.first_spa_date} onChange={e => setFormData({...formData, first_spa_date: e.target.value})} />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Est. Completion</label>
                       <input type="date" className={`${inputClass} bg-gray-100 font-bold text-[#003366]`} value={formData.est_completion} readOnly />
                       <p className="text-xs text-gray-500 mt-1">Auto-calculated (+36 months)</p>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Total Units</label>
                       <input type="number" className={`${inputClass} bg-gray-100`} value={formData.units_total} readOnly />
                       <p className="text-xs text-gray-500 mt-1">Sum of Property Types</p>
                    </div>
                 </div>
              </section>

              {/* 5. Property Type Configuration (NEW) */}
              <section>
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                     <h4 className="font-bold text-[#003366] flex items-center gap-2"><List size={18}/> Unit Configuration</h4>
                     <button onClick={addPropertyType} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-1">
                        <Plus size={16} /> Add Type
                     </button>
                  </div>
                  <div className="space-y-3">
                      {(formData.property_types || []).map((pt, index) => (
                          <div key={pt.id} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <div className="col-span-7">
                                  <label className="block text-xs font-bold text-gray-500 mb-1">Property Type</label>
                                  <input 
                                    className={inputClass} 
                                    value={pt.type} 
                                    onChange={e => updatePropertyType(pt.id, 'type', e.target.value)} 
                                    placeholder="e.g. 2 Storey Terrace"
                                  />
                              </div>
                              <div className="col-span-3">
                                  <label className="block text-xs font-bold text-gray-500 mb-1">Units</label>
                                  <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={pt.units} 
                                    onChange={e => updatePropertyType(pt.id, 'units', Number(e.target.value))} 
                                  />
                              </div>
                              <div className="col-span-2 flex justify-end mt-4">
                                  <button onClick={() => removePropertyType(pt.id)} className="text-red-500 hover:text-red-700 p-2">
                                      <Trash2 size={18} />
                                  </button>
                              </div>
                          </div>
                      ))}
                      {(formData.property_types || []).length === 0 && (
                          <div className="text-center py-6 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-300">
                              No property types defined. Click "Add Type" to configure units.
                          </div>
                      )}
                  </div>
              </section>

              {/* 6. Master Chargee */}
              <section>
                 <h4 className="font-bold text-[#003366] mb-4 flex items-center gap-2 border-b pb-2"><Landmark size={18}/> Master Chargee</h4>
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                       <label className="block text-sm font-bold text-gray-700 mb-1">Master Chargee Name (Bank)</label>
                       <input className={inputClass} value={formData.master_chargee?.bank_name} onChange={e => setFormData({...formData, master_chargee: { ...formData.master_chargee!, bank_name: e.target.value }})} placeholder="e.g. Maybank Islamic Berhad" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Registration No</label>
                       <input className={inputClass} value={formData.master_chargee?.registration_no} onChange={e => setFormData({...formData, master_chargee: { ...formData.master_chargee!, registration_no: e.target.value }})} placeholder="e.g. 196001000142" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Presentation No</label>
                       <input className={inputClass} value={formData.master_chargee?.presentation_no} onChange={e => setFormData({...formData, master_chargee: { ...formData.master_chargee!, presentation_no: e.target.value }})} placeholder="Presentation Number" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Presentation Date</label>
                       <input type="date" className={inputClass} value={formData.master_chargee?.presentation_date} onChange={e => setFormData({...formData, master_chargee: { ...formData.master_chargee!, presentation_date: e.target.value }})} />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-sm font-bold text-gray-700 mb-1">Bank Address</label>
                       <textarea rows={2} className={inputClass} value={formData.master_chargee?.bank_address} onChange={e => setFormData({...formData, master_chargee: { ...formData.master_chargee!, bank_address: e.target.value }})} placeholder="Full Bank Address..." />
                    </div>
                 </div>
              </section>

            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-8 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                <Save size={18} /> Save Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
