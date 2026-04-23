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
  const isAdmin = profile?.role === 'admin'

  // Poll for urgent items — different logic for admin vs regular users
  useEffect(() => {
    if (!profile) return
    checkUrgent()
    const interval = setInterval(checkUrgent, 60000)
    return () => clearInterval(interval)
  }, [profile])

  async function checkUrgent() {
    try {
      if (isAdmin) {
        // Admin: count pending users + pending listings + open reports
        const [users, listings, reports] = await Promise.all([
          api.admin.getUsers({ status: 'pending' }),
          api.admin.getListings({ status: 'pending_review' }),
          api.admin.getReports()
        ])
        setUrgentCount(
          (users.users?.length || 0) +
          (listings.listings?.length || 0) +
          (reports.reports?.length || 0)
        )
      } else {
        // Regular user: count offers needing action
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
      }
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
                  {/* Dashboard link with notification badge */}
                  <Link to="/" className={isActive('/')} style={{ position: 'relative' }}>
                    {isAdmin ? 'Dashboard' : 'Dashboard'}
                    {urgentCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: -4,
                        background: 'var(--gold)', color: 'var(--navy)',
                        fontSize: 10, fontWeight: 700,
                        width: 16, height: 16, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1
                      }}>
                        {urgentCount > 9 ? '9+' : urgentCount}
                      </span>
                    )}
                  </Link>

                  {/* Admin nav — management only */}
                  {isAdmin && (
                    <>
                      <Link to="/admin" className={isActive('/admin')}>Users & listings</Link>
                      <Link to="/admin/brand-applications" className={isActive('/admin/brand-applications')}>Brand applications</Link>
                      <Link to="/admin/finance" className={isActive('/admin/finance')}>Finance</Link>
                    </>
                  )}

                  {/* Regular user nav */}
                  {!isAdmin && (
                    <>
                      <Link to="/listings" className={isActive('/listings')}>Browse</Link>
                      {(profile.role === 'supplier' || profile.role === 'retailer') && (
                        <Link to="/listings/new" className={isActive('/listings/new')}>+ New listing</Link>
                      )}
                      {(profile.role === 'supplier' || profile.role === 'retailer') && (
                        <Link to="/my-listings" className={isActive('/my-listings')}>My listings</Link>
                      )}
                    </>
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
