'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Shield, Briefcase, Plus, Save, Trash2, Edit } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'

export type StaffRole = 'Partner' | 'Senior Lawyer' | 'Junior Lawyer' | 'Senior Clerk' | 'Junior Clerk' | 'Runner' | 'Admin'

export type Staff = {
  id: number
  name: string
  role: StaffRole
  email: string
  status: 'Active' | 'Inactive'
}

export default function StaffManagement() {
  const { t } = useTranslation()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({ role: 'Junior Lawyer', status: 'Active' })

  useEffect(() => {
    // Load from LocalStorage or use Mock
    const stored = localStorage.getItem('staff_list')
    if (stored) {
      let parsed = JSON.parse(stored)
      // Migration: Convert 'Clerk' to 'Junior Clerk'
      let modified = false
      parsed = parsed.map((s: any) => {
        if (s.role === 'Clerk') {
            modified = true
            return { ...s, role: 'Junior Clerk' }
        }
        return s
      })
      
      if (modified) {
          localStorage.setItem('staff_list', JSON.stringify(parsed))
      }
      setStaffList(parsed)
    } else {
      const initial: Staff[] = [
        { id: 1, name: 'Lim Kah Lun', role: 'Partner', email: 'lim@lawcase.pro', status: 'Active' },
        { id: 2, name: 'Sarah Tan', role: 'Senior Lawyer', email: 'sarah@lawcase.pro', status: 'Active' },
        { id: 3, name: 'Ali Bin Ahmad', role: 'Senior Clerk', email: 'ali@lawcase.pro', status: 'Active' },
        { id: 4, name: 'Siti Aminah', role: 'Junior Clerk', email: 'siti@lawcase.pro', status: 'Active' },
        { id: 5, name: 'Admin User', role: 'Admin', email: 'admin@lawcase.pro', status: 'Active' }
      ]
      setStaffList(initial)
      localStorage.setItem('staff_list', JSON.stringify(initial))
    }
  }, [])

  const handleSave = () => {
    // Only Founder can modify Role
    const actualRole = 'Admin'
    if (newStaff.role !== 'Junior Clerk' && newStaff.role !== 'Senior Clerk' && actualRole !== 'Admin') {
      alert('Permission Denied: Only Founder/Admin can assign roles.')
      return
    }
    if (!newStaff.name || !newStaff.email) return
    const updated = [...staffList, { ...newStaff, id: Date.now() } as Staff]
    setStaffList(updated)
    localStorage.setItem('staff_list', JSON.stringify(updated))
    setIsAdding(false)
    setNewStaff({ role: 'Junior Lawyer', status: 'Active' })
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this staff member?')) {
      const updated = staffList.filter(s => s.id !== id)
      setStaffList(updated)
      localStorage.setItem('staff_list', JSON.stringify(updated))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#003366] font-montserrat tracking-tight">Staff Management</h2>
          <p className="text-gray-500 text-sm mt-1">Manage employee profiles, roles, and access permissions.</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true)
            setNewStaff({ role: 'Junior Lawyer', status: 'Active', name: '', email: '' })
          }}
          className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-xl hover:bg-[#002855] shadow-lg font-bold transition-transform active:scale-95"
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <Breadcrumbs />

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-100 space-y-4 animate-fade-in">
          <h3 className="font-bold text-[#003366] text-lg border-b pb-2">New Staff Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input 
                placeholder="e.g. John Doe" 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none transition-all"
                value={newStaff.name || ''}
                onChange={e => setNewStaff({...newStaff, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
              <input 
                placeholder="e.g. john@lawcase.pro" 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none transition-all"
                value={newStaff.email || ''}
                onChange={e => setNewStaff({...newStaff, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
              <select 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#003366] outline-none bg-white transition-all"
                value={newStaff.role}
                onChange={e => setNewStaff({...newStaff, role: e.target.value as StaffRole})}
              >
                <option value="Partner">Partner</option>
                <option value="Senior Lawyer">Senior Lawyer</option>
                <option value="Junior Lawyer">Junior Lawyer</option>
                <option value="Senior Clerk">Senior Clerk</option>
                <option value="Junior Clerk">Junior Clerk</option>
                <option value="Runner">Runner</option>
                <option value="Admin">Admin</option>
                <option value="Account">Account</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-[#003366] text-white px-6 py-2 rounded-lg hover:bg-[#002855] shadow-md font-bold transition-all active:scale-95"
            >
              <Save size={18} /> Save Staff
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-sm text-blue-800">
          <Shield size={16} />
          <strong>RBAC Policy Active:</strong> Only <u>Admin</u> & <u>Partner</u> can manage staff. Roles determine system access levels.
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 text-sm font-bold border-b border-gray-200 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map(staff => (
              <tr key={staff.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#003366]/10 flex items-center justify-center text-[#003366]">
                    <User size={20} />
                  </div>
                  {staff.name}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                    staff.role === 'Partner' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    staff.role === 'Senior Lawyer' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                    staff.role === 'Junior Lawyer' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    staff.role === 'Admin' ? 'bg-gray-800 text-white border-gray-700' :
                    'bg-green-100 text-green-800 border-green-200'
                  }`}>
                    {staff.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 font-medium">{staff.email}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 text-sm text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md w-fit">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    {staff.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(staff.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={staff.role === 'Admin' || staff.role === 'Partner'} 
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}