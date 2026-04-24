import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [pendingListings, setPendingListings] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [
        usersResp,
        brandsResp,
        listingsResp,
        reportsResp
      ] = await Promise.all([
        api.admin.getUsers({ status: 'pending' }),
        api.admin.getBrands(),
        api.admin.getListings({ status: 'pending_review' }),
        api.admin.getReports()
      ])

      setPendingUsers(usersResp.users || [])
      setPendingListings(listingsResp.listings || [])
      setReports(reportsResp.reports || [])

      // Load financial stats directly from Supabase
      const { data: paidOffers } = await supabase
        .from('offers')
        .select('agreed_price_pence, offered_price_pence, quantity, platform_fee_pence, seller_payout_pence, updated_at')
        .eq('status', 'paid')
        .order('updated_at', { ascending: false })

      const { data: allUsers } = await supabase
        .from('user_profiles')
        .select('id, status, role, created_at')

      const { data: allListings } = await supabase
        .from('listings')
        .select('id, status')

      const { data: allOffers } = await supabase
        .from('offers')
        .select('id, status')

      // Calculate stats
      const totalFees = (paidOffers || []).reduce((s, o) => s + (o.platform_fee_pence || 0), 0)
      const totalGoodsValue = (paidOffers || []).reduce((s, o) =>
        s + ((o.agreed_price_pence || o.offered_price_pence) * o.quantity), 0)
      const totalTransactions = (paidOffers || []).length

      setStats({
        // Financial
        totalFees,
        totalGoodsValue,
        totalTransactions,
        // Users
        totalUsers: (allUsers || []).length,
        pendingUsers: (allUsers || []).filter(u => u.status === 'pending').length,
        approvedUsers: (allUsers || []).filter(u => u.status === 'approved').length,
        suppliers: (allUsers || []).filter(u => u.role === 'supplier').length,
        retailers: (allUsers || []).filter(u => u.role === 'retailer').length,
        // Listings
        activeListings: (allListings || []).filter(l => l.status === 'active').length,
        pendingListings: (allListings || []).filter(l => l.status === 'pending_review').length,
        soldListings: (allListings || []).filter(l => l.status === 'sold').length,
        // Offers
        activeOffers: (allOffers || []).filter(o => ['pending','countered','accepted'].includes(o.status)).length,
        // Brands
        totalBrands: (brandsResp.brands || []).length,
        // Reports
        openReports: (reportsResp.reports || []).length
      })

      setRecentOrders((paidOffers || []).slice(0, 5))

    } catch (err) {
      console.error(err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  async function quickApproveUser(id) {
    try {
      await api.admin.approveUser(id)
      setPendingUsers(u => u.filter(x => x.id !== id))
      setStats(s => s ? { ...s, pendingUsers: s.pendingUsers - 1, approvedUsers: s.approvedUsers + 1 } : s)
    } catch (err) { setError(err.message) }
  }

  async function quickApproveListing(id) {
    try {
      await api.admin.approveListing(id)
      setPendingListings(l => l.filter(x => x.id !== id))
      setStats(s => s ? { ...s, pendingListings: s.pendingListings - 1, activeListings: s.activeListings + 1 } : s)
    } catch (err) { setError(err.message) }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  const urgentCount = (stats?.pendingUsers || 0) + (stats?.pendingListings || 0) + (stats?.openReports || 0)

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            Admin dashboard
          </h1>
          <p style={{ color: urgentCount > 0 ? 'var(--amber)' : 'var(--slate)', fontSize: 14, fontWeight: urgentCount > 0 ? 500 : 400 }}>
            {urgentCount > 0
              ? `⚡ ${urgentCount} item${urgentCount !== 1 ? 's' : ''} require your attention`
              : '✓ All clear — nothing requiring immediate attention'
            }
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* ── FINANCIAL HIGHLIGHTS ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 14 }}>
            Platform revenue
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Platform fees earned', value: formatPrice(stats?.totalFees || 0), highlight: true },
              { label: 'Total goods transacted', value: formatPrice(stats?.totalGoodsValue || 0) },
              { label: 'Completed transactions', value: stats?.totalTransactions || 0 },
              { label: 'Offers in progress', value: stats?.activeOffers || 0 },
            ].map((card, i) => (
              <div key={i} style={{
                background: card.highlight ? 'var(--navy)' : 'var(--white)',
                border: `1px solid ${card.highlight ? 'var(--navy)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '16px 20px',
                cursor: card.onClick ? 'pointer' : 'default'
              }} onClick={card.onClick}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400,
                  color: card.highlight ? 'var(--gold-light)' : 'var(--navy)',
                  marginBottom: 4
                }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 13, color: card.highlight ? 'rgba(255,255,255,0.6)' : 'var(--muted)' }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PLATFORM ACTIVITY ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 14 }}>
            Platform activity
          </h2>
          <div className="stat-cards">
            {[
              { label: 'Total members', value: stats?.totalUsers || 0, sub: `${stats?.suppliers || 0} suppliers · ${stats?.retailers || 0} retailers` },
              { label: 'Active listings', value: stats?.activeListings || 0, sub: `${stats?.soldListings || 0} sold` },
              { label: 'Total brands', value: stats?.totalBrands || 0, sub: 'Registered on platform' },
            ].map((card, i) => (
              <div key={i} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--navy)', marginBottom: 2 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate)', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Pending user approvals */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                  Pending approvals
                  {pendingUsers.length > 0 && (
                    <span style={{ marginLeft: 8, background: 'var(--amber)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      {pendingUsers.length}
                    </span>
                  )}
                </h2>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>
                  View all →
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  ✓ No pending applications
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {pendingUsers.slice(0, 5).map((user, i) => (
                    <div key={user.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < pendingUsers.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{user.company_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {user.email} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => quickApproveUser(user.id)}>
                          Approve
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>
                          Review →
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingUsers.length > 5 && (
                    <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                      +{pendingUsers.length - 5} more — <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 500 }}>view all</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Pending listings */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                  Listing review
                  {pendingListings.length > 0 && (
                    <span style={{ marginLeft: 8, background: 'var(--amber)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      {pendingListings.length}
                    </span>
                  )}
                </h2>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>
                  View all →
                </button>
              </div>

              {pendingListings.length === 0 ? (
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  ✓ No listings awaiting review
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {pendingListings.slice(0, 5).map((listing, i) => (
                    <div key={listing.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < pendingListings.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{listing.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {listing.brands?.name} · £{(listing.price_pence / 100).toFixed(2)}/unit
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => quickApproveListing(listing.id)}>
                          Approve
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>
                          Review →
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingListings.length > 5 && (
                    <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                      +{pendingListings.length - 5} more — <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 500 }}>view all</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Open reports */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                  Open reports
                  {reports.length > 0 && (
                    <span style={{ marginLeft: 8, background: 'var(--red)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      {reports.length}
                    </span>
                  )}
                </h2>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>
                  View all →
                </button>
              </div>

              {reports.length === 0 ? (
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  ✓ No open reports
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {reports.slice(0, 4).map((report, i) => (
                    <div key={report.id} style={{
                      padding: '12px 16px',
                      borderBottom: i < reports.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{report.listing?.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{report.reason}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Reported by {report.reporter?.anonymous_handle} · {new Date(report.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent transactions */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Recent transactions</h2>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/finance')}>
                  Full report →
                </button>
              </div>

              {recentOrders.length === 0 ? (
                <div className="card" style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No completed transactions yet
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {recentOrders.map((order, i) => {
                    const goodsValue = (order.agreed_price_pence || order.offered_price_pence) * order.quantity
                    return (
                      <div key={order.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < recentOrders.length - 1 ? '1px solid var(--border)' : 'none'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{formatPrice(goodsValue)}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {new Date(order.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
                            +{formatPrice(order.platform_fee_pence || 0)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>platform fee</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Quick links */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 14 }}>Quick links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Manage users & brands', path: '/admin' },
                  { label: 'Listings & orders', path: '/admin/listings' },
                  { label: 'Brand applications', path: '/admin/brand-applications' },
                  { label: 'Finance & fee settings', path: '/admin/finance' },
                ].map(link => (
                  <button
                    key={link.path}
                    className="btn btn-outline"
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => navigate(link.path)}
                  >
                    {link.label} <span>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
