import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

const LISTING_STATUS_CONFIG = {
  active:         { label: 'Live',           class: 'badge-approved' },
  pending_review: { label: 'Pending review', class: 'badge-pending' },
  draft:          { label: 'Draft',          class: 'badge-draft' },
  removed:        { label: 'Removed',        class: 'badge-removed' },
  sold:           { label: 'Sold',           class: 'badge-approved' },
}

export default function AdminUserPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [brands, setBrands] = useState([])
  const [permissions, setPermissions] = useState([])
  const [brandApplications, setBrandApplications] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [listingAction, setListingAction] = useState(null) // { id, action }
  const [listingActionNote, setListingActionNote] = useState('')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [userResp, brandsResp, permsResp, listingsResp] = await Promise.all([
        api.admin.getUser(id),
        api.admin.getBrands(),
        api.admin.getUserPermissions(id),
        api.admin.getListings({ seller_id: id })
      ])

      if (!userResp.user) {
        setError('User not found')
        setLoading(false)
        return
      }

      setUser(userResp.user)
      setBrands(brandsResp.brands || [])
      setPermissions(permsResp.permissions || [])
      setListings(listingsResp.listings || [])

      // Load brand applications for this user
      const { data: apps } = await supabase
        .from('brand_applications')
        .select('*, brand:brand_id(id, name)')
        .eq('user_id', id)
        .order('applied_at', { ascending: false })
      setBrandApplications(apps || [])

    } catch (err) {
      console.error('AdminUserPage error:', err)
      setError('Failed to load user: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action) {
    setError('')
    setSuccess('')
    try {
      switch (action) {
        case 'approve':
          await api.admin.approveUser(id)
          setSuccess('User approved — they can now log in')
          break
        case 'suspend':
          await api.admin.suspendUser(id)
          setSuccess('User suspended')
          break
        case 'reject':
          await api.admin.rejectUser(id, 'Account cancelled by admin')
          setSuccess('User account cancelled')
          break
        case 'reinstate':
          await supabase.from('user_profiles').update({ status: 'approved' }).eq('id', id)
          setSuccess('User reinstated')
          break
      }
      setConfirmAction(null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleListingAction(listingId, action) {
    setError('')
    setSuccess('')
    try {
      switch (action) {
        case 'approve':
          await api.admin.approveListing(listingId)
          setSuccess('Listing approved and now live')
          break
        case 'remove':
          await api.admin.removeListing(listingId, listingActionNote)
          setSuccess('Listing removed')
          break
        case 'pause':
          await supabase
            .from('listings')
            .update({ status: 'draft' })
            .eq('id', listingId)
          setSuccess('Listing paused — hidden from buyers until reactivated')
          break
        case 'reactivate':
          await supabase
            .from('listings')
            .update({ status: 'pending_review' })
            .eq('id', listingId)
          setSuccess('Listing resubmitted for review')
          break
      }
      setListingAction(null)
      setListingActionNote('')
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function grantBrand(brandId) {
    try {
      await api.admin.grantPermission(id, brandId)
      setSuccess('Brand access granted')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  async function revokeBrand(brandId) {
    try {
      await api.admin.revokePermission(id, brandId)
      setSuccess('Brand access revoked')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return (
    <div className="page"><div className="container">
      <div className="empty-state"><h3>User not found</h3></div>
    </div></div>
  )

  const activePerms = permissions.filter(p => !p.revoked_at)
  const activeListings = listings.filter(l => l.status === 'active').length
  const pendingListings = listings.filter(l => l.status === 'pending_review').length

  const STATUS_CONFIG = {
    pending:   { label: 'Pending approval', class: 'badge-pending',  actions: ['approve', 'reject'] },
    approved:  { label: 'Active',           class: 'badge-approved', actions: ['suspend', 'reject'] },
    suspended: { label: 'Suspended',        class: 'badge-suspended', actions: ['reinstate', 'reject'] },
    rejected:  { label: 'Cancelled',        class: 'badge-rejected', actions: ['reinstate'] },
  }
  const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.pending

  const ACTION_CONFIG = {
    approve:   { label: 'Approve account',  class: 'btn-outline', confirm: false, style: { borderColor: 'var(--green)', color: 'var(--green)' } },
    suspend:   { label: 'Suspend account',  class: 'btn-danger',  confirm: true,  confirmMsg: 'This will immediately block this user from logging in.' },
    reject:    { label: 'Cancel account',   class: 'btn-danger',  confirm: true,  confirmMsg: 'This will permanently cancel this account.' },
    reinstate: { label: 'Reinstate account',class: 'btn-outline', confirm: true,  confirmMsg: "This will restore this user's access to the platform.", style: { borderColor: 'var(--green)', color: 'var(--green)' } },
  }

  // Which actions are available per listing status
  function getListingActions(status) {
    switch (status) {
      case 'active':         return ['pause', 'remove']
      case 'pending_review': return ['approve', 'remove']
      case 'draft':          return ['reactivate', 'remove']
      case 'removed':        return ['reactivate']
      default:               return []
    }
  }

  const LISTING_ACTION_CONFIG = {
    approve:    { label: 'Approve',    class: 'btn-outline', style: { borderColor: 'var(--green)', color: 'var(--green)' }, confirm: false },
    pause:      { label: 'Pause',      class: 'btn-outline', style: { borderColor: 'var(--amber)', color: 'var(--amber)' }, confirm: true, confirmMsg: 'This listing will be hidden from buyers but can be reactivated.' },
    remove:     { label: 'Remove',     class: 'btn-danger',  confirm: true, confirmMsg: 'This listing will be permanently removed.', needsNote: true },
    reactivate: { label: 'Reactivate', class: 'btn-outline', style: { borderColor: 'var(--green)', color: 'var(--green)' }, confirm: false },
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>

        <button className="btn btn-outline btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/admin')}>
          ← Back to admin
        </button>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* ── User header ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{user.company_name}</h1>
                <span className={`badge ${statusCfg.class}`}>{statusCfg.label}</span>
                <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{user.role}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                <span>📧 {user.email}</span>
                <span>👤 {user.contact_name}</span>
                {user.phone && <span>📞 {user.phone}</span>}
                <span>🏷️ {user.anonymous_handle}</span>
                <span>📅 Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {user.approved_at && <span>✓ Approved {new Date(user.approved_at).toLocaleDateString('en-GB')}</span>}
              </div>
              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Active listings', value: activeListings },
                  { label: 'Pending review', value: pendingListings },
                  { label: 'Approved brands', value: activePerms.length },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--navy)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Account actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
              {statusCfg.actions.map(action => {
                const cfg = ACTION_CONFIG[action]
                return (
                  <button key={action} className={`btn ${cfg.class} btn-sm`}
                    style={{ justifyContent: 'center', ...cfg.style }}
                    onClick={() => cfg.confirm ? setConfirmAction(action) : handleAction(action)}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Listings ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>
            Listings
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''} total
          </p>

          {listings.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No listings from this user yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {listings.map(listing => {
                const sc = LISTING_STATUS_CONFIG[listing.status] || LISTING_STATUS_CONFIG.draft
                const actions = getListingActions(listing.status)
                return (
                  <div key={listing.id} style={{
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    overflow: 'hidden'
                  }}>
                    {/* Listing row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 0 }}>

                      {/* Thumbnail */}
                      <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
                        {listing.image_urls?.length > 0 ? (
                          <img src={listing.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 9, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>No img</span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{listing.title}</span>
                          <span className={`badge ${sc.class}`} style={{ fontSize: 11 }}>{sc.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>{listing.brands?.name}</span>
                          <span>{formatPrice(listing.price_pence)}/unit</span>
                          <span>{listing.quantity} unit{listing.quantity !== 1 ? 's' : ''}</span>
                          <span>{new Date(listing.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {actions.length > 0 && (
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', borderLeft: '1px solid var(--border)', minWidth: 110 }}>
                          {actions.map(action => {
                            const cfg = LISTING_ACTION_CONFIG[action]
                            return (
                              <button
                                key={action}
                                className={`btn ${cfg.class} btn-sm`}
                                style={{ justifyContent: 'center', fontSize: 12, padding: '5px 10px', ...cfg.style }}
                                onClick={() => {
                                  if (cfg.confirm) {
                                    setListingAction({ id: listing.id, action })
                                  } else {
                                    handleListingAction(listing.id, action)
                                  }
                                }}
                              >
                                {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Brand access ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Brand access</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {activePerms.length} active brand{activePerms.length !== 1 ? 's' : ''}
          </p>
          {brands.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No brands on the platform yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {brands.map(brand => {
                const perm = permissions.find(p => p.brand_id === brand.id)
                const active = perm && !perm.revoked_at
                return (
                  <div key={brand.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: active ? 'var(--green-bg)' : 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: active ? 'var(--green)' : 'var(--navy)' }}>
                        {active ? '✓ ' : ''}{brand.name}
                      </div>
                      {active && perm.granted_at && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          Granted {new Date(perm.granted_at).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                    <button
                      className={`btn btn-sm ${active ? 'btn-danger' : 'btn-outline'}`}
                      style={{ justifyContent: 'center' }}
                      onClick={() => active ? revokeBrand(brand.id) : grantBrand(brand.id)}
                    >
                      {active ? 'Revoke' : 'Grant'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Brand applications ── */}
        {brandApplications.length > 0 && (
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Brand applications</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {brandApplications.map(app => (
                <div key={app.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--surface)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {app.is_other ? app.brand_name_text : app.brand?.name}
                    </span>
                    {app.is_other && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 100 }}>
                        Unregistered
                      </span>
                    )}
                  </div>
                  <span className={`badge badge-${app.status}`} style={{ textTransform: 'capitalize' }}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              Manage applications in{' '}
              <button onClick={() => navigate('/admin/brand-applications')}
                style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 500, fontSize: 12, textDecoration: 'underline' }}>
                Brand applications
              </button>
            </p>
          </div>
        )}

        {/* ── Account action confirm modal ── */}
        {confirmAction && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>
                {ACTION_CONFIG[confirmAction]?.label}?
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 20 }}>
                {ACTION_CONFIG[confirmAction]?.confirmMsg}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button className={`btn ${ACTION_CONFIG[confirmAction]?.class}`} onClick={() => handleAction(confirmAction)}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Listing action confirm modal ── */}
        {listingAction && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>
                {LISTING_ACTION_CONFIG[listingAction.action]?.label} listing?
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 16 }}>
                {LISTING_ACTION_CONFIG[listingAction.action]?.confirmMsg}
              </p>
              {LISTING_ACTION_CONFIG[listingAction.action]?.needsNote && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Reason (optional)</label>
                  <textarea
                    className="form-input" rows={2}
                    value={listingActionNote}
                    onChange={e => setListingActionNote(e.target.value)}
                    placeholder="Reason for removal — shown in audit log"
                    style={{ resize: 'none' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setListingAction(null); setListingActionNote('') }}>Cancel</button>
                <button
                  className={`btn ${LISTING_ACTION_CONFIG[listingAction.action]?.class}`}
                  onClick={() => handleListingAction(listingAction.id, listingAction.action)}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
