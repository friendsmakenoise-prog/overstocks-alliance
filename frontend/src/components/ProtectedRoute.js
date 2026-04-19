import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Redirects unauthenticated users to login
// Redirects pending/suspended users to a holding page
// Optionally restricts to specific roles

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profile?.status === 'pending') return <Navigate to="/pending" replace />
  if (profile?.status === 'suspended' || profile?.status === 'rejected') {
    return <Navigate to="/access-denied" replace />
  }

  if (roles && !roles.includes(profile?.role)) {
    return <Navigate to="/listings" replace />
  }

  return children
}
