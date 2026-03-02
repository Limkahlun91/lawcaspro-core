'use client'

import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { supabase, hasSupabase } from '../lib/supabaseClient'
import { Upload, CheckCircle, Image as ImageIcon, Camera } from 'lucide-react'

type Task = {
  id: number
  title: string
  location: string
  fee: number
  status: 'pending' | 'completed'
  proof_url?: string
}

export default function RunnerTasks() {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: 'Land Office Submission', location: 'Pejabat Tanah Johor', fee: 35, status: 'pending' },
    { id: 2, title: 'Stamp Duty Payment', location: 'LHDN Jalan Duta', fee: 15, status: 'pending' },
    { id: 3, title: 'Bank Document Pickup', location: 'Maybank HQ', fee: 60, status: 'completed', proof_url: 'https://placehold.co/400x300?text=Proof+Example' },
  ])

  const handleUpload = async (taskId: number, file: File) => {
    if (!hasSupabase || !supabase) {
      alert('Supabase not connected')
      return
    }

    try {
      setUploading(taskId)
      const fileName = `proof-${taskId}-${Date.now()}.jpg`
      const { data, error } = await supabase.storage
        .from('runner-proofs')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('runner-proofs')
        .getPublicUrl(fileName)

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed', proof_url: publicUrl } : t
      ))
      
      // Ideally save to DB here: await supabase.from('tasks').update({ proof_url: publicUrl }).eq('id', taskId)
      // Save to local storage for PurchaserDocs to pick up (Demo only)
      const timestamp = new Date().toLocaleString()
      localStorage.setItem(`runner-proof-${taskId}`, JSON.stringify({ url: publicUrl, timestamp }))
      
      // Also update status to Completed
      localStorage.setItem(`task-status-${taskId}`, 'completed')

    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed')
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{t('nav.runnerTasks')}</h2>
        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
          {tasks.filter(t => t.status === 'pending').length} Tasks Pending
        </div>
      </div>

      <div className="grid gap-4">
        {tasks.map(task => (
          <div key={task.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                <h3 className="font-semibold text-gray-800">{task.title}</h3>
              </div>
              <p className="text-gray-500 text-sm flex items-center gap-1">
                📍 {task.location} • RM {task.fee.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {task.proof_url ? (
                <div className="flex flex-col items-end">
                  <a href={task.proof_url} target="_blank" rel="noopener noreferrer" className="group relative w-16 h-16 rounded overflow-hidden border border-gray-200 block">
                    <img src={task.proof_url} alt="Proof" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                  </a>
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle size={12} /> Uploaded
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUpload(task.id, e.target.files[0])
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading === task.id}
                  />
                  <button 
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all w-full justify-center active:scale-95 ${
                      uploading === task.id 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-[#003366] text-white hover:bg-[#002855] shadow-lg'
                    }`}
                  >
                    {uploading === task.id ? (
                      <span className="animate-spin">⌛</span>
                    ) : (
                      <Camera size={20} />
                    )}
                    {uploading === task.id ? 'Uploading...' : 'Snap Receipt'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}