import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
    
    // Auto-Reload on Chunk Load Error (Max 1 Retry)
    if (error.message && (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed')
    )) {
        const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || 0)
        
        if (reloadCount < 1) {
            console.log('Chunk Load Error Detected. Reloading...')
            sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
            window.location.reload()
        } else {
            console.error('Max chunk reloads reached. Manual refresh required.')
            // Let the UI show the error screen
        }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-[#003366]">
            <h2 className="text-2xl font-bold mb-2">System Updating...</h2>
            <p className="text-gray-600 mb-4">We detected a version update. Refreshing the application for you.</p>
            <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-[#003366] text-white rounded-lg hover:bg-[#002244]"
            >
                Refresh Now
            </button>
        </div>
      )
    }

    return this.props.children
  }
}
