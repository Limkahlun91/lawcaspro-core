import { useState, useEffect } from 'react'
import { Plus, Search, Building2, MapPin, Phone, Edit, Trash2, X, Save, User } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'

type Contact = {
  id: number
  name: string
  department: string
  phone: string
  email: string
}

type Developer = {
  id: number
  name: string
  registration_no: string
  registered_address: string
  business_address: string
  department?: string
  contacts: Contact[]
  status: 'Active' | 'Inactive'
  projects_count: number
}

export default function Developers() {
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDev, setEditingDev] = useState<Developer | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Developer>>({
    name: '',
    department: '',
    registration_no: '',
    registered_address: '',
    business_address: '',
    contacts: [],
    status: 'Active'
  })

  useEffect(() => {
    const stored = localStorage.getItem('developers')
    if (stored) {
      setDevelopers(JSON.parse(stored))
    } else {
      const initial: Developer[] = [
        { 
          id: 1, 
          name: 'Sunway Property', 
          registration_no: '123456-A',
          registered_address: 'Level 16, Menara Sunway, Jalan Lagoon Timur, Bandar Sunway, 47500 Subang Jaya, Selangor',
          business_address: 'The Pinnacle, Persiaran Lagoon, Bandar Sunway, 47500 Subang Jaya, Selangor',
          contacts: [
            { id: 1, name: 'Mr. Tan', department: 'Sales', phone: '03-5639 8888', email: 'enquiry@sunway.com' }
          ],
          status: 'Active',
          projects_count: 5 
        },
        { 
          id: 2, 
          name: 'EcoWorld', 
          registration_no: '654321-B',
          registered_address: 'Suite 52, Setia Avenue, No. 2, Jalan Setia Prima S U13/S, Setia Alam Seksyen U13, 40170 Shah Alam, Selangor',
          business_address: 'Eco World Gallery @ Eco Majestic, No. 1, Lingkaran Eco Majestic, 43500 Semenyih, Selangor',
          contacts: [
            { id: 1, name: 'Ms. Lee', department: 'Marketing', phone: '03-3344 2525', email: 'sales@ecoworld.my' }
          ],
          status: 'Active',
          projects_count: 3 
        },
      ]
      setDevelopers(initial)
      localStorage.setItem('developers', JSON.stringify(initial))
    }
  }, [])

  const handleSave = () => {
    if (!formData.name) return alert('Developer Name is required')

    let updatedDevs
    if (editingDev) {
      updatedDevs = developers.map(d => d.id === editingDev.id ? { ...d, ...formData } as Developer : d)
    } else {
      const newDev: Developer = {
        ...formData,
        id: Date.now(),
        projects_count: 0
      } as Developer
      updatedDevs = [...developers, newDev]
    }

    setDevelopers(updatedDevs)
    localStorage.setItem('developers', JSON.stringify(updatedDevs))
    setShowModal(false)
    setEditingDev(null)
    setFormData({ name: '', registration_no: '', registered_address: '', business_address: '', contacts: [], status: 'Active' })
  }

  const handleEdit = (dev: Developer) => {
    setEditingDev(dev)
    setFormData(dev)
    setShowModal(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this developer?')) {
      const updated = developers.filter(d => d.id !== id)
      setDevelopers(updated)
      localStorage.setItem('developers', JSON.stringify(updated))
    }
  }

  // Contact Management
  const addContact = () => {
    if ((formData.contacts?.length || 0) >= 10) return alert('Maximum 10 contacts allowed.')
    const newContact: Contact = {
        id: Date.now(),
        name: '',
        department: '',
        phone: '',
        email: ''
    }
    setFormData({ ...formData, contacts: [...(formData.contacts || []), newContact] })
  }

  const removeContact = (id: number) => {
    setFormData({ ...formData, contacts: formData.contacts?.filter(c => c.id !== id) })
  }

  const updateContact = (id: number, field: keyof Contact, value: string) => {
    setFormData({
        ...formData,
        contacts: formData.contacts?.map(c => c.id === id ? { ...c, [field]: value } : c)
    })
  }

  const filtered = developers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.registration_no?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none text-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Developer Management</h2>
          <p className="text-gray-500 text-sm mt-1">Manage developer profiles and contact information.</p>
        </div>
        <button 
          onClick={() => {
            setEditingDev(null)
            setFormData({ name: '', registration_no: '', registered_address: '', business_address: '', contacts: [], status: 'Active' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
        >
          <Plus size={18} /> New Developer
        </button>
      </div>

      <Breadcrumbs />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <Search className="text-gray-400" size={20} />
        <input 
          className="flex-1 outline-none text-gray-700"
          placeholder="Search developer name or registration no..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(dev => (
          <div key={dev.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 relative group">
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => handleEdit(dev)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
               <button onClick={() => handleDelete(dev.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
             </div>
             
             <div className="flex items-center gap-3 mb-4">
               <div className="bg-blue-100 p-3 rounded-lg text-[#003366]">
                 <Building2 size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-lg text-gray-800 leading-tight">{dev.name}</h3>
                 <span className="text-xs text-gray-500 font-mono">Reg: {dev.registration_no || 'N/A'}</span>
               </div>
             </div>

             <div className="space-y-3 text-sm text-gray-600">
               <div className="flex items-start gap-2">
                 <MapPin size={16} className="mt-1 text-gray-400 shrink-0" />
                 <div>
                    <span className="block font-semibold text-xs text-gray-400 uppercase">Business Address</span>
                    <span className="line-clamp-2">{dev.business_address || '-'}</span>
                 </div>
               </div>
               {dev.contacts && dev.contacts.length > 0 && (
                   <div className="flex items-start gap-2">
                       <Phone size={16} className="mt-1 text-gray-400 shrink-0" />
                       <div>
                           <span className="block font-semibold text-xs text-gray-400 uppercase">Primary Contact</span>
                           <span>{dev.contacts[0].name} ({dev.contacts[0].phone})</span>
                       </div>
                   </div>
               )}
             </div>

             <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
               <span className={`px-2 py-1 rounded text-xs font-bold ${dev.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                 {dev.status}
               </span>
               <span className="text-xs font-bold text-gray-500">{dev.projects_count} Projects</span>
             </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-[#003366] flex items-center gap-2">
                {editingDev ? <Edit size={20} /> : <Plus size={20} />}
                {editingDev ? 'Edit Developer' : 'New Developer'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Developer Name <span className="text-red-500">*</span></label>
                  <input className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Department</label>
                  <input className={inputClass} value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="e.g. Sales & Marketing" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Company Reg No.</label>
                  <input className={inputClass} value={formData.registration_no} onChange={e => setFormData({...formData, registration_no: e.target.value})} placeholder="e.g. 123456-A" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                  <select className={inputClass} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Address Section */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <h4 className="font-bold text-[#003366] flex items-center gap-2"><MapPin size={18}/> Addresses</h4>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Registered Address</label>
                  <textarea rows={2} className={inputClass} value={formData.registered_address} onChange={e => setFormData({...formData, registered_address: e.target.value})} placeholder="Official registered address..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Business Address</label>
                  <textarea rows={2} className={inputClass} value={formData.business_address} onChange={e => setFormData({...formData, business_address: e.target.value})} placeholder="Operating office address..." />
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-4">
                 <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                    <h4 className="font-bold text-[#003366] flex items-center gap-2"><Phone size={18}/> Contact Information</h4>
                    <button onClick={addContact} className="text-xs bg-white text-blue-600 px-3 py-1 rounded border border-blue-200 font-bold hover:bg-blue-50 flex items-center gap-1">
                        <Plus size={14} /> Add Contact
                    </button>
                 </div>
                 
                 <div className="space-y-3">
                     {formData.contacts?.map((contact, index) => (
                         <div key={contact.id} className="bg-white p-3 rounded-lg border border-blue-100 relative">
                             <button onClick={() => removeContact(contact.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                                 <X size={16} />
                             </button>
                             <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Contact #{index + 1}</h5>
                             <div className="grid grid-cols-2 gap-3">
                                 <div>
                                     <input className={inputClass} value={contact.name} onChange={e => updateContact(contact.id, 'name', e.target.value)} placeholder="Name" />
                                 </div>
                                 <div>
                                     <input className={inputClass} value={contact.department} onChange={e => updateContact(contact.id, 'department', e.target.value)} placeholder="Department" />
                                 </div>
                                 <div>
                                     <input className={inputClass} value={contact.phone} onChange={e => updateContact(contact.id, 'phone', e.target.value)} placeholder="Phone" />
                                 </div>
                                 <div>
                                     <input className={inputClass} value={contact.email} onChange={e => updateContact(contact.id, 'email', e.target.value)} placeholder="Email" />
                                 </div>
                             </div>
                         </div>
                     ))}
                     {(!formData.contacts || formData.contacts.length === 0) && (
                         <div className="text-center text-gray-400 italic text-sm py-4">No contacts added.</div>
                     )}
                 </div>
              </div>

            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-8 py-2 bg-[#003366] text-white font-bold rounded-lg hover:bg-[#002855] shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                <Save size={18} /> Save Developer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
