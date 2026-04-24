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
  draft:          { label: 'Paused',         class: 'badge-draft' },
  removed:        { label: 'Removed',        class: 'badge-rejected' },
  sold:           { label: 'Sold',           class: 'badge-approved' },
}

export default function AdminUserPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [brands, setBrands] = useState([])
  const [permissions, setPermissions] = useState([])
  const [brandApplications, setBrandApplications] = useState([])
  const [supplierDistributions, setSupplierDistributions] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [listingAction, setListingAction] = useState(null)
  const [listingActionNote, setListingActionNote] = useState('')
  // Supplier brand approval
  const [approvingBrand, setApprovingBrand] = useState(null) // app being processed
  const [newBrandName, setNewBrandName] = useState('') // for creating a new brand

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

      if (!userResp.user) { setError('User not found'); setLoading(false); return }

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

      // If supplier, also load their distributions
      if (userResp.user.role === 'supplier') {
        const { data: dists } = await supabase
          .from('supplier_brand_distributions')
          .select('*, brand:brand_id(id, name)')
          .eq('supplier_id', id)
        setSupplierDistributions(dists || [])
      }

    } catch (err) {
      setError('Failed to load user: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action) {
    setError(''); setSuccess('')
    try {
      switch (action) {
        case 'approve':  await api.admin.approveUser(id); setSuccess('User approved'); break
        case 'suspend':  await api.admin.suspendUser(id); setSuccess('User suspended'); break
        case 'reject':   await api.admin.rejectUser(id, 'Account cancelled by admin'); setSuccess('Account cancelled'); break
        case 'reinstate':await supabase.from('user_profiles').update({ status: 'approved' }).eq('id', id); setSuccess('User reinstated'); break
      }
      setConfirmAction(null)
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  async function handleListingAction(listingId, action) {
    setError(''); setSuccess('')
    try {
      switch (action) {
        case 'approve':    await api.admin.approveListing(listingId); setSuccess('Listing approved'); break
        case 'remove':     await api.admin.removeListing(listingId, listingActionNote); setSuccess('Listing removed'); break
        case 'pause':      await supabase.from('listings').update({ status: 'draft' }).eq('id', listingId); setSuccess('Listing paused'); break
        case 'reactivate': await supabase.from('listings').update({ status: 'pending_review' }).eq('id', listingId); setSuccess('Listing resubmitted'); break
      }
      setListingAction(null); setListingActionNote('')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  async function grantBrand(brandId) {
    try { await api.admin.grantPermission(id, brandId); setSuccess('Brand access granted'); await loadAll() }
    catch (err) { setError(err.message) }
  }

  async function revokeBrand(brandId) {
    try { await api.admin.revokePermission(id, brandId); setSuccess('Brand access revoked'); await loadAll() }
    catch (err) { setError(err.message) }
  }

  // ── Supplier: approve brand submission ────────────────────
  async function approveSupplierBrand(app, existingBrandId) {
    setError(''); setSuccess('')
    try {
      let brandId = existingBrandId

      // If no existing brand selected, create a new one
      if (!brandId) {
        const name = newBrandName.trim() || (app.is_other ? app.brand_name_text : app.brand?.name)
        if (!name) return setError('Please enter a brand name')

        const { data: newBrand, error: brandError } = await supabase
          .from('brands')
          .insert({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), status: 'active' })
          .select()
          .single()

        if (brandError) {
          // Brand might already exist
          const { data: existing } = await supabase.from('brands').select('id').eq('name', name).single()
          if (existing) { brandId = existing.id }
          else throw brandError
        } else {
          brandId = newBrand.id
        }
      }

      // Update the application to approved and link to brand
      await supabase.from('brand_applications')
        .update({ brand_id: brandId, is_other: false, status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user.id })
        .eq('id', app.id)

      // Add to supplier_brand_distributions
      await supabase.from('supplier_brand_distributions')
        .upsert({ supplier_id: id, brand_id: brandId, is_other: false, verified: true }, { onConflict: 'supplier_id,brand_id', ignoreDuplicates: true })

      setSuccess(`Brand approved and added to platform`)
      setApprovingBrand(null)
      setNewBrandName('')
      await loadAll()
    } catch (err) { setError('Failed to approve brand: ' + err.message) }
  }

  async function declineSupplierBrand(appId) {
    try {
      await supabase.from('brand_applications')
        .update({ status: 'declined', reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user.id })
        .eq('id', appId)
      setSuccess('Brand submission declined')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <div className="page"><div className="container"><div className="empty-state"><h3>User not found</h3></div></div></div>

  const isSupplier = user.role === 'supplier'
  const activePerms = permissions.filter(p => !p.revoked_at)
  const activeListings = listings.filter(l => l.status === 'active').length
  const pendingListings = listings.filter(l => l.status === 'pending_review').length

  const STATUS_CONFIG = {
    pending:   { label: 'Pending approval', class: 'badge-pending',   actions: ['approve', 'reject'] },
    approved:  { label: 'Active',           class: 'badge-approved',  actions: ['suspend', 'reject'] },
    suspended: { label: 'Suspended',        class: 'badge-suspended', actions: ['reinstate', 'reject'] },
    rejected:  { label: 'Cancelled',        class: 'badge-rejected',  actions: ['reinstate'] },
  }
  const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.pending

  const ACTION_CONFIG = {
    approve:   { label: 'Approve account',  class: 'btn-outline', confirm: false, style: { borderColor: 'var(--green)', color: 'var(--green)' } },
    suspend:   { label: 'Suspend account',  class: 'btn-danger',  confirm: true,  confirmMsg: 'This will immediately block this user from logging in.' },
    reject:    { label: 'Cancel account',   class: 'btn-danger',  confirm: true,  confirmMsg: 'This will permanently cancel this account.' },
    reinstate: { label: 'Reinstate account',class: 'btn-outline', confirm: true,  confirmMsg: "This will restore this user's access.", style: { borderColor: 'var(--green)', color: 'var(--green)' } },
  }

  function getListingActions(status) {
    switch (status) {
      case 'active':         return ['pause', 'remove']
      case 'pending_review': return ['approve', 'remove']
      case 'draft':          return ['reactivate', 'remove']
      case 'removed':        return ['reactivate']
      default: return []
    }
  }

  const LISTING_ACTION_CONFIG = {
    approve:    { label: 'Approve',    class: 'btn-outline', style: { borderColor: 'var(--green)', color: 'var(--green)' }, confirm: false },
    pause:      { label: 'Pause',      class: 'btn-outline', style: { borderColor: 'var(--amber)', color: 'var(--amber)' }, confirm: true, confirmMsg: 'This listing will be hidden from buyers.' },
    remove:     { label: 'Remove',     class: 'btn-danger',  confirm: true, confirmMsg: 'This listing will be permanently removed.', needsNote: true },
    reactivate: { label: 'Reactivate', class: 'btn-outline', style: { borderColor: 'var(--green)', color: 'var(--green)' }, confirm: false },
  }

  // Pending supplier brand submissions
  const pendingBrandApps = brandApplications.filter(a => a.status === 'pending' || a.status === 'reviewing')
  const processedBrandApps = brandApplications.filter(a => a.status === 'approved' || a.status === 'declined')

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>

        <button className="btn btn-outline btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/admin')}>
          ← Back to admin
        </button>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* ── User header ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{user.company_name}</h1>
                <span className={`badge ${statusCfg.class}`}>{statusCfg.label}</span>
                <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{user.role}</span>
              </div>

              {/* Contact details grid */}
              <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
                {[
                  { icon: '📧', label: 'Email',    value: user.email },
                  { icon: '👤', label: 'Contact',  value: user.contact_name },
                  { icon: '📞', label: 'Phone',    value: user.phone },
                  { icon: '🌐', label: 'Website',  value: user.website, link: true },
                  { icon: '🏷️', label: 'Handle',   value: user.anonymous_handle },
                  { icon: '📅', label: 'Joined',   value: new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].filter(f => f.value).map((field, i) => (
                  <div key={i} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span>{field.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 1 }}>{field.label}</div>
                      {field.link
                        ? <a href={user.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', textDecoration: 'underline' }}>{user.website}</a>
                        : <span style={{ color: 'var(--navy)' }}>{field.value}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Trading address — full width */}
              {user.trading_address && (
                <div style={{ fontSize: 13, marginBottom: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>📍 Trading address</div>
                  <div style={{ color: 'var(--navy)', whiteSpace: 'pre-line' }}>{user.trading_address}</div>
                </div>
              )}

              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Active listings', value: activeListings },
                  { label: 'Pending review',  value: pendingListings },
                  { label: isSupplier ? 'Brands distributed' : 'Approved brands', value: isSupplier ? supplierDistributions.length : activePerms.length },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--navy)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
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

        {/* ── SUPPLIER: Brand submissions ── */}
        {isSupplier && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>
              Brand submissions
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Brands this supplier claims to distribute. Approve to add to the platform brand list, or decline if unverified.
            </p>

            {brandApplications.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No brand submissions yet.</p>
            ) : (
              <>
                {/* Pending submissions */}
                {pendingBrandApps.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 10, color: 'var(--amber)' }}>
                      ⏳ Awaiting review ({pendingBrandApps.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {pendingBrandApps.map(app => {
                        const brandName = app.is_other ? app.brand_name_text : app.brand?.name
                        const isApproving = approvingBrand === app.id
                        // Check if brand already exists on platform
                        const existingBrand = brands.find(b => b.name.toLowerCase() === brandName?.toLowerCase())

                        return (
                          <div key={app.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', flexWrap: 'wrap', gap: 10 }}>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{brandName}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                  {app.is_other ? 'Not yet on platform' : 'Already registered'}
                                  {existingBrand && !app.is_other && <span style={{ color: 'var(--green)', marginLeft: 6 }}>✓ Matched</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
                                  onClick={() => setApprovingBrand(isApproving ? null : app.id)}
                                >
                                  {isApproving ? 'Cancel' : '✓ Approve'}
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => declineSupplierBrand(app.id)}
                                >
                                  ✗ Decline
                                </button>
                              </div>
                            </div>

                            {/* Approve options */}
                            {isApproving && (
                              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                                {existingBrand ? (
                                  <div>
                                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 10 }}>
                                      <strong>{existingBrand.name}</strong> already exists on the platform. Approve this supplier as a distributor?
                                    </p>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => approveSupplierBrand(app, existingBrand.id)}
                                    >
                                      ✓ Approve as distributor of {existingBrand.name}
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 10 }}>
                                      This brand doesn't exist on the platform yet. Confirm the name to add it:
                                    </p>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      <input
                                        className="form-input"
                                        style={{ flex: 1, minWidth: 160 }}
                                        value={newBrandName || brandName || ''}
                                        onChange={e => setNewBrandName(e.target.value)}
                                        placeholder="Brand name to create"
                                      />
                                      <select
                                        className="form-input"
                                        style={{ flex: '0 1 200px' }}
                                        onChange={e => e.target.value && approveSupplierBrand(app, e.target.value)}
                                        defaultValue=""
                                      >
                                        <option value="">Or link to existing brand…</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                      </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => approveSupplierBrand(app, null)}
                                        disabled={!(newBrandName.trim() || brandName)}
                                      >
                                        ✓ Create brand &amp; approve
                                      </button>
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                                      This will add the brand to the platform brand list and mark this supplier as a verified distributor.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Processed submissions */}
                {processedBrandApps.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)', marginBottom: 10 }}>
                      Processed
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {processedBrandApps.map(app => (
                        <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>{app.is_other ? app.brand_name_text : app.brand?.name}</span>
                          <span className={`badge badge-${app.status}`} style={{ textTransform: 'capitalize' }}>{app.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── RETAILER: Brand access ── */}
        {!isSupplier && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Brand access</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {activePerms.length} active brand{activePerms.length !== 1 ? 's' : ''}
            </p>
            {brands.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No brands on platform yet.</p>
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

            {/* Retailer brand applications */}
            {brandApplications.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)', marginBottom: 10 }}>Applications</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {brandApplications.map(app => (
                    <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{app.is_other ? app.brand_name_text : app.brand?.name}</span>
                      <span className={`badge badge-${app.status}`} style={{ textTransform: 'capitalize' }}>{app.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Listings ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Listings</h2>
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
                  <div key={listing.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div className="listing-card-row-sm">
                      <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
                        {listing.image_urls?.length > 0 ? (
                          <img src={listing.image_urls[0]} alt="" style={{ width: '100%', height: 56, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 9, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>No img</span>
                        )}
                      </div>
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
                      {actions.length > 0 && (
                        <div className="listing-card-actions-col">
                          {actions.map(action => {
                            const cfg = LISTING_ACTION_CONFIG[action]
                            return (
                              <button key={action} className={`btn ${cfg.class} btn-sm`}
                                style={{ justifyContent: 'center', fontSize: 12, padding: '5px 10px', ...cfg.style }}
                                onClick={() => cfg.confirm ? setListingAction({ id: listing.id, action }) : handleListingAction(listing.id, action)}
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

        {/* ── Account action confirm modal ── */}
        {confirmAction && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>{ACTION_CONFIG[confirmAction]?.label}?</h3>
              <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 20 }}>{ACTION_CONFIG[confirmAction]?.confirmMsg}</p>
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
              <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 16 }}>{LISTING_ACTION_CONFIG[listingAction.action]?.confirmMsg}</p>
              {LISTING_ACTION_CONFIG[listingAction.action]?.needsNote && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Reason (optional)</label>
                  <textarea className="form-input" rows={2} value={listingActionNote} onChange={e => setListingActionNote(e.target.value)} placeholder="Reason for removal…" style={{ resize: 'none' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setListingAction(null); setListingActionNote('') }}>Cancel</button>
                <button className={`btn ${LISTING_ACTION_CONFIG[listingAction.action]?.class}`} onClick={() => handleListingAction(listingAction.id, listingAction.action)}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
