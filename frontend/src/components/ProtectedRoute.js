import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// ============================================================
// PROTECTED ROUTE
// Waits for BOTH auth session AND profile to be fully loaded
// before rendering any page content. This prevents the
// spinning wheel issue after Stripe redirects or hard refreshes.
// All current and future pages get this fix automatically.
// ============================================================

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  // Still loading auth session — show spinner
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  // Auth loaded but no user — send to login
  if (!user) return <Navigate to="/login" replace />

  // User exists but profile hasn't loaded yet — keep waiting
  // This is the key fix: profile loads slightly after the session
  // On Stripe redirects and hard refreshes this gap causes blank pages
  if (!profile) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  // Profile loaded — check status
  if (profile.status === 'pending') return <Navigate to="/pending" replace />
  if (profile.status === 'suspended' || profile.status === 'rejected') {
    return <Navigate to="/access-denied" replace />
  }

  // Check role restrictions
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  // All checks passed — render the page
  return children
}
