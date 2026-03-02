import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App'

// Version Control: Force Reload on Version Mismatch
const currentVersion = import.meta.env.VITE_APP_VERSION
const storedVersion = localStorage.getItem('app_version')

if (currentVersion && storedVersion !== currentVersion) {
  console.log(`New Version Detected: ${currentVersion} (Old: ${storedVersion})`)
  localStorage.setItem('app_version', currentVersion)
  window.location.reload()
} else if (!storedVersion && currentVersion) {
  localStorage.setItem('app_version', currentVersion)
}

// Global Error Handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason)
})

window.addEventListener('error', (event) => {
  console.error('Global Error:', event.error)
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
