import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_CONFIG = {
  active:         { label: 'Live',           class: 'badge-approved' },
  pending_review: { label: 'Pending review', class: 'badge-pending' },
  draft:          { label: 'Paused',         class: 'badge-draft' },
  sold:           { label: 'Sold',           class: 'badge-approved' },
  removed:        { label: 'Removed',        class: 'badge-rejected' },
  flagged:        { label: 'Flagged',        class: 'badge-suspended' },
}

export default function AdminListingsPage() {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [brands, setBrands] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [tab, setTab] = useState('listings') // listings | orders

  // Editing
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Flag modal
  const [flagging, setFlagging] = useState(null) // { type: 'listing'|'order', id, title }
  const [flagReason, setFlagReason] = useState('')

  // Cancel order modal
  const [cancellingOrder, setCancellingOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  // Action confirm
  const [confirming, setConfirming] = useState(null) // { action, id, title }
  const [actionNote, setActionNote] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [listingsResp, brandsResp, ordersResp] = await Promise.all([
        api.admin.getListings({}),
        api.admin.getBrands(),
        api.admin.getOrders()
      ])
      setListings(listingsResp.listings || [])
      setBrands(brandsResp.brands || [])
      setOrders(ordersResp.orders || [])
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data — ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtered listings ─────────────────────────────────────
  const filteredListings = listings.filter(l => {
    const q = search.toLowerCase()
    const matchQ = !q || l.title?.toLowerCase().includes(q) || l.brands?.name?.toLowerCase().includes(q) || l.seller?.company_name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchBrand  = !brandFilter  || l.brands?.id === brandFilter
    return matchQ && matchStatus && matchBrand
  })

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase()
    return !q || o.listing?.title?.toLowerCase().includes(q) || o.buyer?.anonymous_handle?.toLowerCase().includes(q)
  })

  // ── Edit listing ──────────────────────────────────────────
  function startEdit(listing) {
    setEditingId(listing.id)
    setEditForm({
      title: listing.title || '',
      price_pounds: (listing.price_pence / 100).toFixed(2),
      quantity: listing.quantity || 1,
      description: listing.description || '',
      open_to_all: listing.open_to_all || false,
    })
  }

  async function saveEdit(listingId) {
    setSavingEdit(true)
    setError('')
    try {
      await api.admin.updateListing(listingId, {
        title: editForm.title.trim(),
        price_pence: Math.round(parseFloat(editForm.price_pounds) * 100),
        quantity: parseInt(editForm.quantity),
        description: editForm.description?.trim() || '',
        open_to_all: editForm.open_to_all,
      })
      setSuccess('Listing updated')
      setEditingId(null)
      await loadAll()
    } catch (err) {
      setError('Failed to save: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Listing actions ───────────────────────────────────────
  async function handleListingAction(listingId, action, note) {
    setError('')
    try {
      switch (action) {
        case 'approve':
          await api.admin.approveListing(listingId)
          setSuccess('Listing approved and live')
          break
        case 'pause':
          await api.admin.pauseListing(listingId)
          setSuccess('Listing paused')
          break
        case 'reactivate':
          await api.admin.reactivateListing(listingId)
          setSuccess('Listing reactivated')
          break
        case 'remove':
          await api.admin.removeListing(listingId, note)
          setSuccess('Listing removed')
          break
        case 'flag':
          await api.admin.flagListing(listingId, note)
          setSuccess('Listing flagged for investigation — it is now hidden from buyers')
          break
      }
      setConfirming(null)
      setFlagging(null)
      setActionNote('')
      await loadAll()
    } catch (err) {
      setError('Action failed: ' + err.message)
    }
  }

  // ── Order actions ─────────────────────────────────────────
  async function cancelOrder(orderId, reason) {
    setError('')
    try {
      await api.admin.cancelOrder(orderId, reason)
      setSuccess('Order cancelled — remember to process any refund manually through Stripe')
      setCancellingOrder(null)
      setCancelReason('')
      await loadAll()
    } catch (err) {
      setError('Failed to cancel order: ' + err.message)
    }
  }

  async function flagOrder(orderId, reason) {
    setError('')
    try {
      await api.admin.flagOrder(orderId, reason)
      setSuccess('Order flagged for investigation')
      setFlagging(null)
      setFlagReason('')
      await loadAll()
    } catch (err) {
      setError('Failed to flag order: ' + err.message)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            Listings & orders
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            Browse and manage all platform listings and completed orders
          </p>
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* Tabs */}
        <div className="tab-row" style={{ marginBottom: 20 }}>
          {[
            { key: 'listings', label: `Listings (${listings.length})` },
            { key: 'orders',   label: `Orders (${orders.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
              color: tab === t.key ? 'var(--navy)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid var(--navy)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s'
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & filter bar */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ flex: '1 1 200px', minWidth: 160 }}
            type="search"
            placeholder={tab === 'listings' ? 'Search by title, brand, seller…' : 'Search by listing or buyer…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {tab === 'listings' && (
            <>
              <select className="form-input" style={{ flex: '0 1 150px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select className="form-input" style={{ flex: '0 1 160px' }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                <option value="">All brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
          {(search || statusFilter || brandFilter) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setBrandFilter('') }}>Clear</button>
          )}
        </div>

        {/* ── LISTINGS TAB ── */}
        {tab === 'listings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredListings.length === 0 ? (
              <div className="empty-state"><h3>No listings match your search</h3></div>
            ) : filteredListings.map(listing => {
              const sc = STATUS_CONFIG[listing.status] || STATUS_CONFIG.draft
              const isEditing = editingId === listing.id

              return (
                <div key={listing.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                  {/* Listing row */}
                  <div className="listing-card-row">

                    {/* Thumbnail */}
                    <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, cursor: ['active', 'flagged', 'draft'].includes(listing.status) ? 'pointer' : 'default' }}
                      onClick={() => navigate(`/listings/${listing.id}`)}>
                      {listing.image_urls?.length > 0 ? (
                        <img src={listing.image_urls[0]} alt="" style={{ width: '100%', height: 64, objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>No img</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{listing.title}</span>
                        <span className={`badge ${sc.class}`} style={{ fontSize: 11 }}>{sc.label}</span>
                        {listing.open_to_all && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 7px', borderRadius: 100, border: '1px solid rgba(180,83,9,0.2)' }}>
                            OPEN TO ALL
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>{listing.brands?.name}</span>
                        <span>{formatPrice(listing.price_pence)}/unit</span>
                        <span>{listing.quantity} unit{listing.quantity !== 1 ? 's' : ''}</span>
                        <span>{listing.seller?.company_name}</span>
                        <span>{new Date(listing.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      {listing.status === 'flagged' && listing.admin_notes && (
                        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6, padding: '4px 8px', background: 'var(--red-bg)', borderRadius: 4 }}>
                          🚩 Flag reason: {listing.admin_notes}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="listing-card-actions-col">
                      {/* View — available for all statuses admin can access */}
                      {listing.status !== 'removed' && (
                        <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12 }}
                          onClick={() => navigate(`/listings/${listing.id}`)}>
                          👁 View
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12 }}
                        onClick={() => isEditing ? setEditingId(null) : startEdit(listing)}>
                        {isEditing ? 'Cancel edit' : '✏️ Edit'}
                      </button>
                      {listing.status === 'active' && (
                        <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12, borderColor: 'var(--amber)', color: 'var(--amber)' }}
                          onClick={() => setConfirming({ action: 'pause', id: listing.id, title: listing.title })}>
                          ⏸ Pause
                        </button>
                      )}
                      {listing.status === 'active' && (
                        <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12, borderColor: 'var(--red)', color: 'var(--red)' }}
                          onClick={() => setFlagging({ type: 'listing', id: listing.id, title: listing.title })}>
                          🚩 Flag
                        </button>
                      )}
                      {listing.status === 'draft' && (
                        <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12, borderColor: 'var(--green)', color: 'var(--green)' }}
                          onClick={() => setConfirming({ action: 'reactivate', id: listing.id, title: listing.title })}>
                          ▶ Reactivate
                        </button>
                      )}
                      {listing.status === 'flagged' && (
                        <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center', fontSize: 12, borderColor: 'var(--green)', color: 'var(--green)' }}
                          onClick={() => setConfirming({ action: 'reactivate', id: listing.id, title: listing.title })}>
                          ✓ Clear flag
                        </button>
                      )}
                      {!['sold', 'removed'].includes(listing.status) && (
                        <button className="btn btn-danger btn-sm" style={{ justifyContent: 'center', fontSize: 12 }}
                          onClick={() => setConfirming({ action: 'remove', id: listing.id, title: listing.title, needsNote: true })}>
                          🗑 Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                      <div className="grid-2" style={{ marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Title</label>
                          <input className="form-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="grid-2" style={{ gap: 8 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Price/unit (£)</label>
                            <input className="form-input" type="number" min="0.01" step="0.01" value={editForm.price_pounds} onChange={e => setEditForm(f => ({ ...f, price_pounds: e.target.value }))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Quantity</label>
                            <input className="form-input" type="number" min="1" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label">Description</label>
                        <textarea className="form-input" rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none' }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                        <input
                          type="checkbox"
                          checked={editForm.open_to_all || false}
                          onChange={e => setEditForm(f => ({ ...f, open_to_all: e.target.checked }))}
                          style={{ accentColor: 'var(--amber)' }}
                        />
                        <span style={{ color: editForm.open_to_all ? 'var(--amber)' : 'var(--slate)', fontWeight: editForm.open_to_all ? 500 : 400 }}>
                          Open to all verified retailers
                        </span>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(listing.id)} disabled={savingEdit}>
                          {savingEdit ? 'Saving…' : 'Save changes'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredOrders.length === 0 ? (
              <div className="empty-state"><h3>No orders found</h3></div>
            ) : filteredOrders.map(order => {
              const goodsValue = (order.agreed_price_pence || order.offered_price_pence) * order.quantity
              const isFlagged = order.status === 'flagged'

              return (
                <div key={order.id} className="card" style={{ borderColor: isFlagged ? 'var(--red)' : 'var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{order.listing?.title}</span>
                        <span className={`badge ${isFlagged ? 'badge-rejected' : 'badge-approved'}`}>
                          {isFlagged ? '🚩 Flagged' : '✓ Completed'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{order.listing?.brands?.name}</span>
                        <span>{order.quantity} unit{order.quantity !== 1 ? 's' : ''}</span>
                        <span>{formatPrice(goodsValue)}</span>
                        <span>Buyer: {order.buyer?.anonymous_handle}</span>
                        <span>Seller: {order.seller?.anonymous_handle}</span>
                        <span>{new Date(order.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        Platform fee: {formatPrice(order.platform_fee_pence || 0)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ justifyContent: 'center', borderColor: 'var(--red)', color: 'var(--red)' }}
                        onClick={() => setFlagging({ type: 'order', id: order.id, title: order.listing?.title })}
                        disabled={isFlagged}
                      >
                        {isFlagged ? '🚩 Flagged' : '🚩 Flag order'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ justifyContent: 'center' }}
                        onClick={() => setCancellingOrder(order)}
                        disabled={order.status !== 'paid'}
                      >
                        Cancel order
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ justifyContent: 'center' }}
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        View messages →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── FLAG MODAL ── */}
        {flagging && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
            <div className="card" style={{ maxWidth: 420, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>
                Flag {flagging.type === 'order' ? 'order' : 'listing'} for investigation
              </h3>
              <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 16 }}>
                <strong>{flagging.title}</strong> will be flagged and hidden from buyers until reviewed. The seller will not be notified automatically.
              </p>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Reason for flagging *</label>
                <textarea
                  className="form-input" rows={3}
                  value={flagReason}
                  onChange={e => setFlagReason(e.target.value)}
                  placeholder="Describe the suspicious activity or reason for investigation…"
                  style={{ resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setFlagging(null); setFlagReason('') }}>Cancel</button>
                <button
                  className="btn btn-danger"
                  onClick={() => flagging.type === 'order' ? flagOrder(flagging.id, flagReason) : handleListingAction(flagging.id, 'flag', flagReason)}
                  disabled={!flagReason.trim()}
                >
                  Flag {flagging.type}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CANCEL ORDER MODAL ── */}
        {cancellingOrder && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
            <div className="card" style={{ maxWidth: 440, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>Cancel order</h3>
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                ⚠️ Cancelling an order does not automatically issue a refund. You will need to contact both parties and process any refund manually through Stripe.
              </div>
              <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 16 }}>
                Order: <strong>{cancellingOrder.listing?.title}</strong><br />
                Buyer: {cancellingOrder.buyer?.anonymous_handle} · Seller: {cancellingOrder.seller?.anonymous_handle}
              </p>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Reason for cancellation *</label>
                <textarea
                  className="form-input" rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Reason for admin cancellation — logged in audit trail…"
                  style={{ resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setCancellingOrder(null); setCancelReason('') }}>Cancel</button>
                <button
                  className="btn btn-danger"
                  onClick={() => cancelOrder(cancellingOrder.id, cancelReason)}
                  disabled={!cancelReason.trim()}
                >
                  Confirm cancellation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM ACTION MODAL ── */}
        {confirming && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8, textTransform: 'capitalize' }}>
                {confirming.action} listing?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 16 }}>
                <strong>{confirming.title}</strong>
              </p>
              {confirming.needsNote && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Reason (optional)</label>
                  <textarea className="form-input" rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Reason for removal…" style={{ resize: 'none' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setConfirming(null); setActionNote('') }}>Cancel</button>
                <button
                  className={`btn ${['remove'].includes(confirming.action) ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => handleListingAction(confirming.id, confirming.action, actionNote)}
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
