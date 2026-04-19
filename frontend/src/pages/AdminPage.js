import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [brands, setBrands] = useState([])
  const [listings, setListings] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPermissions, setUserPermissions] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [u, b, l, r] = await Promise.all([
        api.admin.getUsers({ status: 'pending' }),
        api.admin.getBrands(),
        api.admin.getListings({ status: 'pending_review' }),
        api.admin.getReports()
      ])
      setUsers(u.users)
      setBrands(b.brands)
      setListings(l.listings)
      setReports(r.reports)
    } catch (err) {
      setError('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  async function approveUser(id) {
    try {
      await api.admin.approveUser(id)
      setUsers(u => u.filter(x => x.id !== id))
    } catch (err) { setError(err.message) }
  }

  async function rejectUser(id) {
    const reason = prompt('Reason for rejection (optional):')
    try {
      await api.admin.rejectUser(id, reason)
      setUsers(u => u.filter(x => x.id !== id))
    } catch (err) { setError(err.message) }
  }

  async function approveListing(id) {
    try {
      await api.admin.approveListing(id)
      setListings(l => l.filter(x => x.id !== id))
    } catch (err) { setError(err.message) }
  }

  async function removeListing(id) {
    const reason = prompt('Reason for removal:')
    try {
      await api.admin.removeListing(id, reason)
      setListings(l => l.filter(x => x.id !== id))
    } catch (err) { setError(err.message) }
  }

  async function createBrand(e) {
    e.preventDefault()
    try {
      const data = await api.admin.createBrand(newBrand)
      setBrands(b => [...b, data.brand])
      setNewBrand('')
    } catch (err) { setError(err.message) }
  }

  async function openUserPermissions(user) {
    setSelectedUser(user)
    const data = await api.admin.getUserPermissions(user.id)
    setUserPermissions(data.permissions)
  }

  async function grantPermission(brandId) {
    try {
      await api.admin.grantPermission(selectedUser.id, brandId)
      const data = await api.admin.getUserPermissions(selectedUser.id)
      setUserPermissions(data.permissions)
    } catch (err) { setError(err.message) }
  }

  async function revokePermission(brandId) {
    try {
      await api.admin.revokePermission(selectedUser.id, brandId)
      const data = await api.admin.getUserPermissions(selectedUser.id)
      setUserPermissions(data.permissions)
    } catch (err) { setError(err.message) }
  }

  const tabs = [
    { key: 'users',    label: `Pending users (${users.length})` },
    { key: 'listings', label: `Listing review (${listings.length})` },
    { key: 'brands',   label: 'Brands' },
    { key: 'reports',  label: `Reports (${reports.length})` },
  ]

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>Admin panel</h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>Manage users, brands, and listings</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedUser(null) }}
              style={{
                padding: '10px 16px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: tab === t.key ? 500 : 400,
                color: tab === t.key ? 'var(--navy)' : 'var(--muted)',
                borderBottom: `2px solid ${tab === t.key ? 'var(--navy)' : 'transparent'}`,
                marginBottom: -1, transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* PENDING USERS */}
        {tab === 'users' && (
          <div>
            {selectedUser ? (
              <div>
                <button className="btn btn-outline btn-sm" style={{ marginBottom: 20 }} onClick={() => setSelectedUser(null)}>
                  ← Back to users
                </button>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4 }}>
                  Brand permissions — {selectedUser.company_name}
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                  {selectedUser.anonymous_handle} · {selectedUser.role} · {selectedUser.email}
                </p>
                <div className="card">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Status</th>
                        <th>Granted</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {brands.map(brand => {
                        const perm = userPermissions.find(p => p.brand_id === brand.id)
                        const active = perm && !perm.revoked_at
                        return (
                          <tr key={brand.id}>
                            <td style={{ fontWeight: 500 }}>{brand.name}</td>
                            <td>
                              <span className={`badge ${active ? 'badge-approved' : 'badge-draft'}`}>
                                {active ? 'Granted' : 'Not granted'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                              {active ? new Date(perm.granted_at).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {active ? (
                                <button className="btn btn-danger btn-sm" onClick={() => revokePermission(brand.id)}>
                                  Revoke
                                </button>
                              ) : (
                                <button className="btn btn-outline btn-sm" onClick={() => grantPermission(brand.id)}>
                                  Grant
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                {users.length === 0 ? (
                  <div className="empty-state"><h3>No pending applications</h3></div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Contact</th>
                          <th>Role</th>
                          <th>Applied</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ fontWeight: 500 }}>{u.company_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
                            </td>
                            <td>{u.contact_name}</td>
                            <td><span className="badge badge-pending" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                            <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                              {new Date(u.created_at).toLocaleDateString('en-GB')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => approveUser(u.id)}>
                                  Approve
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => rejectUser(u.id)}>
                                  Reject
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => openUserPermissions(u)}>
                                  Brands →
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LISTING REVIEW */}
        {tab === 'listings' && (
          <div>
            {listings.length === 0 ? (
              <div className="empty-state"><h3>No listings awaiting review</h3></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Brand</th>
                      <th>Price</th>
                      <th>Seller</th>
                      <th>Submitted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 500, maxWidth: 220 }}>{l.title}</td>
                        <td>{l.brands?.name}</td>
                        <td>£{(l.price_pence / 100).toFixed(2)}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {l.seller?.anonymous_handle}<br />
                          <span style={{ color: 'var(--slate)' }}>{l.seller?.company_name}</span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                          {new Date(l.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => approveListing(l.id)}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => removeListing(l.id)}>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BRANDS */}
        {tab === 'brands' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Brand name</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.name}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{b.slug}</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {new Date(b.created_at).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Add a brand</h3>
              <form onSubmit={createBrand}>
                <div className="form-group">
                  <label className="form-label">Brand name</label>
                  <input
                    className="form-input" type="text"
                    value={newBrand} onChange={e => setNewBrand(e.target.value)}
                    required placeholder="e.g. Nike"
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Create brand
                </button>
              </form>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div>
            {reports.length === 0 ? (
              <div className="empty-state"><h3>No open reports</h3></div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Brand</th>
                      <th>Reason</th>
                      <th>Reported by</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.listing?.title}</td>
                        <td>{r.listing?.brands?.name}</td>
                        <td style={{ maxWidth: 200, color: 'var(--slate)' }}>{r.reason}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.reporter?.anonymous_handle}</td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {new Date(r.created_at).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
