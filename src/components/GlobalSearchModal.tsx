import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, FileText, ArrowRight, X, Clock, Zap } from 'lucide-react'
import { useFirmCases } from '../hooks/useFirmCases'
import { CaseHistory } from '../utils/caseHistory'

export default function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCases, setRecentCases] = useState<any[]>([])
  
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Use the optimized search hook
  const { cases: searchResults, loading: isSearching, searchCases } = useFirmCases()

  // Toggle Modal with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus input when opened & Load Recents
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setRecentCases(CaseHistory.getSuggestions())
    } else {
      setSearchTerm('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Cross-Tab Sync
  useEffect(() => {
      const handleStorage = (e: StorageEvent) => {
          if (e.key === 'lawcase_smart_history') {
              setRecentCases(CaseHistory.getSuggestions())
          }
      }
      window.addEventListener('storage', handleStorage)
      return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchCases(searchTerm)
        setSelectedIndex(0)
      }
    }, 300) // 300ms for quicker response in global search
    return () => clearTimeout(timer)
  }, [searchTerm, searchCases])

  // Determine which list to display
  const displayList = searchTerm.length >= 2 ? searchResults : recentCases
  const isRecentMode = searchTerm.length < 2

  // Keyboard Navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (displayList.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % displayList.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + displayList.length) % displayList.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selectedCase = displayList[selectedIndex]
      if (selectedCase) {
        handleSelection(selectedCase, e.shiftKey)
      }
    }
  }

  const handleSelection = (caseData: any, isShiftKey: boolean) => {
    // Track Usage
    CaseHistory.trackAccess(caseData)

    setIsOpen(false)
    if (isShiftKey) {
      // Shift+Enter -> Go to Master Document
      navigate('/master-document', { state: { selectedCaseId: caseData.id } })
    } else {
      // Enter -> Go to Case Details
      navigate('/cases', { state: { openCaseId: caseData.id } })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Content */}
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Search Header */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <Search className="text-gray-400 mr-3" size={20} />
          <input 
            ref={inputRef}
            type="text"
            className="flex-1 outline-none text-lg font-medium text-gray-800 placeholder:text-gray-400 bg-transparent"
            placeholder="Search cases (Client, Ref, NRIC)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <div className="flex items-center gap-2">
            {isSearching && <Loader2 className="animate-spin text-blue-600" size={18} />}
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {displayList.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                 {isRecentMode ? <><Clock size={12}/> Recent & Smart Suggestions</> : 'Search Results'}
              </div>
              {displayList.map((c, index) => (
                <div 
                  key={c.id}
                  onClick={() => handleSelection(c, false)}
                  className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 border-blue-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${index === selectedIndex ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {isRecentMode ? <Zap size={18} className={index < 3 ? 'text-yellow-600' : ''} /> : <FileText size={18} />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${index === selectedIndex ? 'text-blue-900' : 'text-gray-800'}`}>
                        {c.client}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {c.fileRef || 'No Ref'}
                        </span>
                        {c.purchaser_nric && <span>• {c.purchaser_nric}</span>}
                      </div>
                    </div>
                  </div>
                  
                  {index === selectedIndex && (
                    <div className="hidden sm:flex items-center gap-2 text-xs text-blue-600 font-medium animate-in fade-in slide-in-from-left-2">
                      <span>Jump to Case</span>
                      <ArrowRight size={14} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : searchTerm.length >= 2 && !isSearching ? (
            <div className="py-12 text-center text-gray-400">
              <p>No matching cases found.</p>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              {searchTerm.length < 2 && recentCases.length === 0 && (
                <div className="space-y-4">
                  <p className="text-sm">Type to search for cases...</p>
                  <div className="flex justify-center gap-4 text-xs">
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      <kbd className="font-sans">↵</kbd> Open Case
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      <kbd className="font-sans">⇧ + ↵</kbd> Master Doc
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500 font-medium">
            <div className="flex gap-3">
                <span><strong className="text-gray-700">Cmd K</strong> to open</span>
                <span><strong className="text-gray-700">↑↓</strong> to navigate</span>
                <span><strong className="text-gray-700">Enter</strong> to select</span>
            </div>
            <div>
                {isRecentMode ? 'Smart History Active' : 'Search-Driven Mode'}
            </div>
        </div>
      </div>
    </div>
  )
}
