import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Nav from './components/Nav'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { PendingPage, AccessDeniedPage } from './pages/HoldingPages'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsPage from './pages/TermsPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import ListingsPage from './pages/ListingsPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import MyListingsPage from './pages/MyListingsPage'
import OffersPage from './pages/OffersPage'
import OrderPage from './pages/OrderPage'
import PaymentSettingsPage from './pages/PaymentSettingsPage'
import BrandAccessPage from './pages/BrandAccessPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminFinancePage from './pages/AdminFinancePage'
import AdminBrandApplicationsPage from './pages/AdminBrandApplicationsPage'
import AdminUserPage from './pages/AdminUserPage'
import AdminListingsPage from './pages/AdminListingsPage'
import './styles/global.css'

function Layout({ children }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}

// Shows admin dashboard for admins, buyer/seller dashboard for everyone else
function HomeDashboard() {
  const { profile } = useAuth()
  if (profile?.role === 'admin') {
    return <Layout><AdminDashboardPage /></Layout>
  }
  return <Layout><DashboardPage /></Layout>
}

// Separate component so it can use useAuth inside AuthProvider
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/signup"         element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms"          element={<TermsPage />} />

      {/* Holding pages */}
      <Route path="/pending"       element={<PendingPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Home — admin gets admin dashboard, others get buyer/seller dashboard */}
      <Route path="/" element={
        <ProtectedRoute>
          <HomeDashboard />
        </ProtectedRoute>
      } />

      {/* Listings */}
      <Route path="/listings" element={
        <ProtectedRoute>
          <Layout><ListingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/listings/new" element={
        <ProtectedRoute roles={['supplier', 'retailer']}>
          <Layout><CreateListingPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/listings/:id" element={
        <ProtectedRoute>
          <Layout><ListingDetailPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Offers + Orders */}
      <Route path="/offers" element={
        <ProtectedRoute roles={['retailer']}>
          <Layout><OffersPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/orders/:id" element={
        <ProtectedRoute>
          <Layout><OrderPage /></Layout>
        </ProtectedRoute>
      } />

      {/* My listings */}
      <Route path="/my-listings" element={
        <ProtectedRoute roles={['supplier', 'retailer']}>
          <Layout><MyListingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout><ProfilePage /></Layout>
        </ProtectedRoute>
      } />

      {/* Settings */}
      <Route path="/settings/payments" element={
        <ProtectedRoute roles={['supplier', 'retailer']}>
          <Layout><PaymentSettingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings/brands" element={
        <ProtectedRoute roles={['supplier', 'retailer']}>
          <Layout><BrandAccessPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin/finance" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AdminFinancePage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/listings" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AdminListingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/users/:id" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AdminUserPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/brand-applications" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AdminBrandApplicationsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/*" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><AdminPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
