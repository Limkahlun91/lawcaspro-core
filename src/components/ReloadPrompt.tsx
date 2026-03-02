import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export default function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="ReloadPrompt-container">
      { (offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 p-4 bg-[#003366] text-white rounded-lg shadow-2xl z-[100] flex flex-col gap-2 animate-slide-up border border-blue-400">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-bold flex items-center gap-2">
                {needRefresh ? <RefreshCw size={16} className="animate-spin" /> : 'Ready'} 
                {needRefresh ? 'Update Available' : 'Offline Ready'}
              </h3>
              <p className="text-xs text-blue-200 mt-1">
                {needRefresh 
                  ? 'A new version of LawCase Pro is available.' 
                  : 'App is ready to work offline.'}
              </p>
            </div>
            <button onClick={close} className="text-blue-300 hover:text-white">
                <X size={16} />
            </button>
          </div>
          
          {needRefresh && (
            <button 
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-bold transition-colors"
              onClick={() => updateServiceWorker(true)}
            >
              Update Now
            </button>
          )}
        </div>
      )}
    </div>
  )
}
