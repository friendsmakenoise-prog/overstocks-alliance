import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Nav from './components/Nav'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { PendingPage, AccessDeniedPage } from './pages/HoldingPages'
import ListingsPage from './pages/ListingsPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
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
          <Route path="/pending"      element={<PendingPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          {/* Protected routes */}
          <Route path="/listings" element={
            <ProtectedRoute>
              <Layout><ListingsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/listings/new" element={
            <ProtectedRoute roles={['supplier']}>
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

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/listings" replace />} />
          <Route path="*" element={<Navigate to="/listings" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
