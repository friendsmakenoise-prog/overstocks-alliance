import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Nav from './components/Nav'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { PendingPage, AccessDeniedPage } from './pages/HoldingPages'
import DashboardPage from './pages/DashboardPage'
import ListingsPage from './pages/ListingsPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import MyListingsPage from './pages/MyListingsPage'
import OffersPage from './pages/OffersPage'
import OrderPage from './pages/OrderPage'
import PaymentSettingsPage from './pages/PaymentSettingsPage'
import AdminPage from './pages/AdminPage'
import './styles/global.css'

function Layout({ children }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}

// Separate component so it can use useAuth inside AuthProvider
function AppRoutes() {
  const { loading } = useAuth()

  // Show a single full-page spinner while auth initialises
  // This runs ONCE on app load and never again
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)'
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24, marginBottom: 24,
          color: 'var(--navy)'
        }}>
          Overstocks <span style={{ color: 'var(--gold)' }}>Alliance</span>
        </div>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Holding pages */}
      <Route path="/pending"       element={<PendingPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Dashboard */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout><DashboardPage /></Layout>
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
        <ProtectedRoute>
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

      {/* Settings */}
      <Route path="/settings/payments" element={
        <ProtectedRoute roles={['supplier', 'retailer']}>
          <Layout><PaymentSettingsPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Admin */}
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
