import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RoleGate from './components/RoleGate'
import GlobalLoader from './components/GlobalLoader'
import AppLayout from './components/AppLayout'

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Cases = lazy(() => import('./pages/Cases'))
const NewCase = lazy(() => import('./pages/NewCase'))
const MasterDocuments = lazy(() => import('./pages/MasterDocuments'))
const GenerateDocuments = lazy(() => import('./pages/GenerateDocuments'))
const StaffManagement = lazy(() => import('./pages/StaffManagement'))
const SystemSettings = lazy(() => import('./pages/SystemSettings'))
const TrackStatus = lazy(() => import('./pages/TrackStatus'))
const Login = lazy(() => import('./pages/Login'))
const RunnerTasks = lazy(() => import('./pages/RunnerTasks'))
const PartnerReports = lazy(() => import('./pages/PartnerReports'))
const PurchaserDocs = lazy(() => import('./pages/PurchaserDocs'))
const Settlement = lazy(() => import('./pages/Settlement'))
const FinanceHub = lazy(() => import('./pages/FinanceHub'))
const DocumentRecognition = lazy(() => import('./pages/DocumentRecognition'))
const Developers = lazy(() => import('./pages/Developers'))
const Projects = lazy(() => import('./pages/Projects'))
const KnowledgeHub = lazy(() => import('./pages/KnowledgeHub'))
const PaymentVouchers = lazy(() => import('./pages/PaymentVouchers'))
const PVTemplateDesigner = lazy(() => import('./pages/PVTemplateDesigner'))
const SmartEngine = lazy(() => import('./pages/SmartEngine'))
const AIIntakeConfirmation = lazy(() => import('./pages/AIIntakeConfirmation'))
const GovGateway = lazy(() => import('./pages/GovGateway'))
const AIControlCenter = lazy(() => import('./pages/admin/AIControlCenter'))
const GovernanceDashboard = lazy(() => import('./pages/admin/GovernanceDashboard'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<GlobalLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes wrapped in AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          
          {/* ================= CASE HUB ================= */}
          <Route path="/case">
             <Route path="dashboard" element={<Dashboard />} /> {/* Case Dashboard View */}
             <Route 
               path="list" 
               element={
                 <RoleGate roles={['Senior Clerk', 'Junior Clerk', 'Founder', 'Partner', 'Senior Lawyer', 'Junior Lawyer', 'Admin']}>
                   <Cases />
                 </RoleGate>
               } 
             />
             <Route path="new" element={<NewCase />} />
             <Route path="details/:id" element={<NewCase />} />
             <Route path="edit/:id" element={<NewCase />} />
             <Route path="status" element={<TrackStatus />} />
             <Route path="projects" element={<Projects />} />
             <Route path="developers" element={<Developers />} />
             <Route path="gov-gateway" element={<GovGateway />} />
          </Route>

          {/* ================= FINANCE HUB ================= */}
          <Route path="/finance">
             <Route path="dashboard" element={<FinanceHub />} />
             <Route path="invoices" element={<FinanceHub />} /> {/* Placeholder for now */}
             <Route path="payment-vouchers" element={<PaymentVouchers />} />
             <Route path="settlement" element={<Settlement />} />
          </Route>

          {/* ================= AI HUB ================= */}
          <Route path="/ai">
             <Route path="smart-engine" element={<SmartEngine />} />
             <Route path="documents" element={<MasterDocuments />} />
             <Route path="generate" element={<GenerateDocuments />} />
             <Route path="recognition" element={<DocumentRecognition />} />
             <Route path="knowledge" element={<KnowledgeHub />} />
             <Route path="intake/:stagingId" element={<AIIntakeConfirmation />} />
          </Route>

          {/* ================= ADMIN HUB ================= */}
          <Route path="/admin">
             <Route path="staff" element={<StaffManagement />} />
             <Route path="settings" element={<SystemSettings />} />
             <Route path="pv-designer" element={<PVTemplateDesigner />} />
             <Route path="ai-control" element={<AIControlCenter />} />
             <Route path="governance" element={<GovernanceDashboard />} />
          </Route>

          {/* ================= LEGACY REDIRECTS (Backwards Compatibility) ================= */}
          <Route path="/cases" element={<Navigate to="/case/list" replace />} />
          <Route path="/new-case" element={<Navigate to="/case/new" replace />} />
          <Route path="/case-details/:id" element={<Navigate to="/case/details/:id" replace />} />
          <Route path="/invoice" element={<Navigate to="/finance/dashboard" replace />} />
          <Route path="/payment-vouchers" element={<Navigate to="/finance/payment-vouchers" replace />} />
          <Route path="/smart-engine" element={<Navigate to="/ai/smart-engine" replace />} />
          <Route path="/documents" element={<Navigate to="/ai/documents" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/staff" element={<Navigate to="/admin/staff" replace />} />

          {/* Special Role Routes */}
          <Route
            path="/runner"
            element={
              <RoleGate roles={['Runner', 'Founder', 'Partner']}>
                <RunnerTasks />
              </RoleGate>
            }
          />
          <Route
            path="/partner"
            element={
              <RoleGate roles={['Partner', 'Founder']}>
                <PartnerReports />
              </RoleGate>
            }
          />
          <Route
            path="/purchaser"
            element={
              <RoleGate roles={['Purchaser', 'Founder', 'Partner']}>
                <PurchaserDocs />
              </RoleGate>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
