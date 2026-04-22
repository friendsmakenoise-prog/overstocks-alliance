import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()
  const [profileTimeout, setProfileTimeout] = useState(false)

  // If user exists but profile hasn't loaded yet,
  // wait up to 5 seconds before giving up
  useEffect(() => {
    if (!loading && user && !profile) {
      const timer = setTimeout(() => setProfileTimeout(true), 5000)
      return () => clearTimeout(timer)
    }
    setProfileTimeout(false)
  }, [loading, user, profile])

  // Auth still initialising
  if (loading) return null

  // No user — go to login
  if (!user) return <Navigate to="/login" replace />

  // User exists but profile still loading — show spinner briefly
  // profileTimeout kicks in after 5 seconds as a safety net
  if (!profile && !profileTimeout) {
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

  // Profile timed out — go to login
  if (!profile && profileTimeout) return <Navigate to="/login" replace />

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
