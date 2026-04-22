import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// By the time this renders, App.js has already waited for
// auth to complete — so loading is always false here.
// This component only needs to check user status and roles.

export default function ProtectedRoute({ children, roles }) {
  const { user, profile } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (!profile) return <Navigate to="/login" replace />

  if (profile.status === 'pending') return <Navigate to="/pending" replace />
  if (profile.status === 'suspended' || profile.status === 'rejected') {
    return <Navigate to="/access-denied" replace />
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
