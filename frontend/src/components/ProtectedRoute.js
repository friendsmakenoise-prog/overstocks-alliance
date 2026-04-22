import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, loadProfile } = useAuth()

  // If user exists but profile didn't load (e.g. slow connection),
  // retry the profile fetch automatically
  useEffect(() => {
    if (!loading && user && !profile) {
      loadProfile(user.id)
    }
  }, [loading, user, profile])

  // Still loading — show spinner
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  // No user — send to login
  if (!user) return <Navigate to="/login" replace />

  // User exists but profile still loading — show spinner briefly
  // The useEffect above will retry and resolve this quickly
  if (!profile) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  // Check account status
  if (profile.status === 'pending') return <Navigate to="/pending" replace />
  if (profile.status === 'suspended' || profile.status === 'rejected') {
    return <Navigate to="/access-denied" replace />
  }

  // Check role restrictions
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
