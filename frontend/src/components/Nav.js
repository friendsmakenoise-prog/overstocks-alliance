import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

export default function Nav() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [urgentCount, setUrgentCount] = useState(0)

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link'

  // Poll for urgent offers every 60 seconds
  useEffect(() => {
    if (!profile) return
    checkUrgent()
    const interval = setInterval(checkUrgent, 60000)
    return () => clearInterval(interval)
  }, [profile])

  async function checkUrgent() {
    try {
      const data = await api.getOffers()
      const urgent = (data.offers || []).filter(o => {
        const isSeller = o.seller?.id === profile?.id
        const isBuyer  = o.buyer?.id  === profile?.id
        return (
          (isSeller && o.status === 'pending') ||
          (isBuyer  && o.status === 'countered') ||
          (isBuyer  && o.status === 'accepted')
        )
      })
      setUrgentCount(urgent.length)
    } catch { /* silent fail */ }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          Overstocks <span>Alliance</span>
        </Link>

        <div className="nav-links">
          {user && (
            <>
              {profile && (
                <>
                  {/* Dashboard with notification badge */}
                  <Link to="/" className={isActive('/')} style={{ position: 'relative' }}>
                    Dashboard
                    {urgentCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: -4,
                        background: 'var(--gold)', color: 'var(--navy)',
                        fontSize: 10, fontWeight: 700,
                        width: 16, height: 16, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1
                      }}>
                        {urgentCount}
                      </span>
                    )}
                  </Link>

                  <Link to="/listings" className={isActive('/listings')}>Browse</Link>

                  {(profile.role === 'supplier' || profile.role === 'retailer') && (
                    <Link to="/listings/new" className={isActive('/listings/new')}>+ New listing</Link>
                  )}

                  {(profile.role === 'supplier' || profile.role === 'retailer') && (
                    <Link to="/my-listings" className={isActive('/my-listings')}>My listings</Link>
                  )}

                  {profile.role === 'admin' && (
                    <Link to="/admin" className={isActive('/admin')}>Admin</Link>
                  )}

                  <span className="nav-handle">{profile.anonymous_handle}</span>
                </>
              )}

              <button
                onClick={handleSignOut}
                className="nav-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
