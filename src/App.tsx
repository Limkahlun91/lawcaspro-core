import { RoleProvider } from './context/RoleContext'
import { AuthProvider } from './context/AuthContext'
import AppRoutes from './AppRoutes'
import ChunkErrorBoundary from './components/ChunkErrorBoundary'
import ReloadPrompt from './components/ReloadPrompt'

function App() {
  console.log(`LawCase Pro Build: ${__BUILD_TIME__}`)
  
  return (
    <ChunkErrorBoundary>
      <AuthProvider>
        <RoleProvider>
          <AppRoutes />
          <ReloadPrompt />
        </RoleProvider>
      </AuthProvider>
    </ChunkErrorBoundary>
  )
}

export default App
