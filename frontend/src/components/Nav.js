import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

export default function Nav() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [urgentCount, setUrgentCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link'
  const isAdmin = profile?.role === 'admin'

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Poll for urgent items
  useEffect(() => {
    if (!profile) return
    checkUrgent()
    const interval = setInterval(checkUrgent, 60000)
    return () => clearInterval(interval)
  }, [profile])

  async function checkUrgent() {
    try {
      if (isAdmin) {
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

  // Build nav links based on role
  const navLinks = !user || !profile ? [] : isAdmin ? [
    { to: '/', label: 'Dashboard', badge: urgentCount },
    { to: '/admin', label: 'Users & brands' },
    { to: '/admin/listings', label: 'Listings & orders' },
    { to: '/admin/brand-applications', label: 'Brand applications' },
    { to: '/admin/finance', label: 'Finance' },
  ] : [
    { to: '/', label: 'Dashboard', badge: urgentCount },
    { to: '/listings', label: 'Browse' },
    ...(profile.role === 'supplier' || profile.role === 'retailer' ? [
      { to: '/listings/new', label: '+ New listing' },
      { to: '/my-listings', label: 'My listings' },
      { to: '/settings/brands', label: 'Brands' },
    ] : []),
  ]

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            Overstocks <span>Alliance</span>
          </Link>

          {/* Desktop nav links */}
          <div className="nav-links">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} className={isActive(link.to)} style={{ position: 'relative' }}>
                {link.label}
                {link.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: -4,
                    background: 'var(--gold)', color: 'var(--navy)',
                    fontSize: 10, fontWeight: 700,
                    width: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {link.badge > 9 ? '9+' : link.badge}
                  </span>
                )}
              </Link>
            ))}
            {user && profile && (
              <>
                <Link to="/profile" className="nav-handle" title="Edit profile">
                  {profile.role === 'supplier' ? 'Supplier' : profile.role === 'retailer' ? 'Retailer' : profile.role === 'admin' ? 'Admin' : 'Account'} ↗
                </Link>
                <button onClick={handleSignOut} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  Sign out
                </button>
              </>
            )}
            {user && !profile && (
              <button onClick={handleSignOut} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Sign out
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          {user && (
            <button
              className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>

        {/* Mobile dropdown menu */}
        {user && (
          <div className={`nav-mobile-menu ${menuOpen ? 'open' : ''}`}>
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} className="nav-link" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {link.label}
                {link.badge > 0 && (
                  <span style={{
                    background: 'var(--gold)', color: 'var(--navy)',
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 100
                  }}>
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
            {profile && (
              <div className="nav-mobile-handle">
                <Link to="/profile" style={{ color: 'var(--gold-light)', textDecoration: 'none' }}>
                  {profile.role === 'supplier' ? 'Supplier' : profile.role === 'retailer' ? 'Retailer' : 'Admin'} account — Edit profile
                </Link>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="nav-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginTop: 4 }}
            >
              Sign out
            </button>
          </div>
        )}
      </nav>
    </>
  )
}
