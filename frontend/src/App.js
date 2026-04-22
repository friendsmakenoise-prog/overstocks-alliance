import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Holding pages (authenticated but not yet approved) */}
          <Route path="/pending"       element={<PendingPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          {/* Dashboard — default home after login */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Protected routes */}
          <Route path="/listings" element={
            <ProtectedRoute>
              <Layout><ListingsPage /></Layout>
            </ProtectedRoute>
          } />

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

          <Route path="/settings/payments" element={
            <ProtectedRoute roles={['supplier', 'retailer']}>
              <Layout><PaymentSettingsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/my-listings" element={
            <ProtectedRoute roles={['supplier', 'retailer']}>
              <Layout><MyListingsPage /></Layout>
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

          <Route path="/admin/*" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><AdminPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
