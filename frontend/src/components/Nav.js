import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Nav() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link'

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          Overstocks <span>Alliance</span>
        </Link>

        <div className="nav-links">
          {/* Always show sign out if there's any session at all */}
          {user && (
            <>
              {profile && (
                <>
                  <Link to="/listings" className={isActive('/listings')}>Browse</Link>

                  {(profile.role === 'supplier' || profile.role === 'retailer') && (
                    <Link to="/listings/new" className={isActive('/listings/new')}>+ New listing</Link>
                  )}

                  {(profile.role === 'supplier' || profile.role === 'retailer') && (
                    <Link to="/my-listings" className={isActive('/my-listings')}>My listings</Link>
                  )}

                  <Link to="/offers" className={isActive('/offers')}>Offers</Link>

                  {profile.role === 'admin' && (
                    <Link to="/admin" className={isActive('/admin')}>Admin</Link>
                  )}

                  <span className="nav-handle">{profile.anonymous_handle}</span>
                </>
              )}

              {/* Sign out always visible when logged in, even if profile fails to load */}
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
