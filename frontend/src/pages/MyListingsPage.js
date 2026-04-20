import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

const STATUS_LABELS = {
  draft:          { label: 'Draft',           class: 'badge-draft' },
  pending_review: { label: 'Pending review',  class: 'badge-pending' },
  active:         { label: 'Live',            class: 'badge-approved' },
  removed:        { label: 'Removed',         class: 'badge-removed' },
  sold:           { label: 'Sold',            class: 'badge-approved' },
}

export default function MyListingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)

  useEffect(() => { loadMyListings() }, [])

  async function loadMyListings() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          id, title, description, price_pence, quantity,
          shipping_mode, shipping_cost_pence, image_urls,
          status, sku, created_at, updated_at,
          brands ( id, name )
        `)
        .eq('seller_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setListings(data || [])
    } catch (err) {
      setError('Failed to load your listings')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(listing) {
    setEditingId(listing.id)
    setEditForm({
      title: listing.title,
      description: listing.description,
      pricePounds: (listing.price_pence / 100).toFixed(2),
      quantity: listing.quantity,
      shippingMode: listing.shipping_mode,
      shippingCostPounds: listing.shipping_cost_pence ? (listing.shipping_cost_pence / 100).toFixed(2) : '',
      sku: listing.sku || ''
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }

  async function saveEdit(listingId) {
    setSaving(true)
    setError('')
    try {
      const updates = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price_pence: Math.round(parseFloat(editForm.pricePounds) * 100),
        quantity: parseInt(editForm.quantity) || 1,
        shipping_mode: editForm.shippingMode,
        shipping_cost_pence: editForm.shippingMode === 'included'
          ? Math.round(parseFloat(editForm.shippingCostPounds) * 100)
          : null,
        sku: editForm.sku || null,
        // Re-submit for review if it was previously active
        status: 'pending_review'
      }

      if (!updates.title) return setError('Title is required')
      if (isNaN(updates.price_pence) || updates.price_pence <= 0) return setError('Please enter a valid price')

      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listingId)
        .eq('seller_id', profile.id) // Security: can only edit own listings

      if (error) throw error

      setEditingId(null)
      await loadMyListings()
    } catch (err) {
      setError('Failed to save changes — ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeListing(listingId) {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'removed' })
        .eq('id', listingId)
        .eq('seller_id', profile.id) // Security: can only remove own listings

      if (error) throw error

      setConfirmRemove(null)
      await loadMyListings()
    } catch (err) {
      setError('Failed to remove listing — ' + err.message)
    }
  }

  async function relistListing(listingId) {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'pending_review' })
        .eq('id', listingId)
        .eq('seller_id', profile.id)

      if (error) throw error
      await loadMyListings()
    } catch (err) {
      setError('Failed to relist — ' + err.message)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
              My listings
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: 14 }}>
              {listings.length} listing{listings.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/listings/new')}>
            + New listing
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {listings.length === 0 ? (
          <div className="empty-state">
            <h3>No listings yet</h3>
            <p>Create your first listing to get started.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/listings/new')}>
              + Create a listing
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {listings.map(listing => (
              <div key={listing.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Collapsed view */}
                {editingId !== listing.id ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 0 }}>

                    {/* Image thumbnail */}
                    <div style={{
                      width: 80, background: 'var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid var(--border)'
                    }}>
                      {listing.image_urls?.length > 0 ? (
                        <img
                          src={listing.image_urls[0]}
                          alt={listing.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>
                          No image
                        </span>
                      )}
                    </div>

                    {/* Listing info */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 15 }}>{listing.title}</span>
                        <span className={`badge ${STATUS_LABELS[listing.status]?.class || 'badge-draft'}`}>
                          {STATUS_LABELS[listing.status]?.label || listing.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
                        <span>{listing.brands?.name}</span>
                        <span>{formatPrice(listing.price_pence)}</span>
                        <span>{listing.quantity} unit{listing.quantity !== 1 ? 's' : ''}</span>
                        <span>{listing.shipping_mode === 'included' ? 'Shipping included' : 'Buyer arranges shipping'}</span>
                      </div>
                      {listing.status === 'pending_review' && (
                        <p style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>
                          ⏳ Awaiting admin review before going live
                        </p>
                      )}
                      {listing.status === 'removed' && (
                        <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                          This listing has been removed and is no longer visible to others
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', borderLeft: '1px solid var(--border)', minWidth: 120 }}>
                      {listing.status !== 'removed' && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startEdit(listing)}
                          style={{ justifyContent: 'center' }}
                        >
                          Edit
                        </button>
                      )}
                      {listing.status === 'removed' ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => relistListing(listing.id)}
                          style={{ justifyContent: 'center' }}
                        >
                          Relist
                        </button>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmRemove(listing.id)}
                          style={{ justifyContent: 'center' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ) : (

                  /* Edit form — expanded inline */
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Edit listing</h3>
                      <button className="btn btn-outline btn-sm" onClick={cancelEdit}>Cancel</button>
                    </div>

                    <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                      Saving changes will re-submit this listing for admin review before it goes live again.
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input
                        className="form-input" type="text"
                        value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        maxLength={150}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description *</label>
                      <textarea
                        className="form-input" rows={4}
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        maxLength={2000}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div className="form-group">
                        <label className="form-label">Price (£) *</label>
                        <input
                          className="form-input" type="number"
                          min="0.01" step="0.01"
                          value={editForm.pricePounds}
                          onChange={e => setEditForm(f => ({ ...f, pricePounds: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input
                          className="form-input" type="number"
                          min="1" max="10000"
                          value={editForm.quantity}
                          onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SKU (optional)</label>
                        <input
                          className="form-input" type="text"
                          value={editForm.sku}
                          onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                          maxLength={100}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Shipping</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        {[
                          { value: 'buyer_arranges', label: 'Buyer arranges shipping' },
                          { value: 'included', label: 'Shipping included' }
                        ].map(opt => (
                          <label key={opt.value} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', border: '1.5px solid',
                            borderColor: editForm.shippingMode === opt.value ? 'var(--navy)' : 'var(--border)',
                            borderRadius: 'var(--radius)', cursor: 'pointer',
                            background: editForm.shippingMode === opt.value ? 'var(--surface)' : 'var(--white)',
                            fontSize: 13
                          }}>
                            <input
                              type="radio" name="editShipping" value={opt.value}
                              checked={editForm.shippingMode === opt.value}
                              onChange={e => setEditForm(f => ({ ...f, shippingMode: e.target.value }))}
                              style={{ accentColor: 'var(--navy)' }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                      {editForm.shippingMode === 'included' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Shipping cost (£)</label>
                          <input
                            className="form-input" type="number"
                            min="0" step="0.01"
                            value={editForm.shippingCostPounds}
                            onChange={e => setEditForm(f => ({ ...f, shippingCostPounds: e.target.value }))}
                            placeholder="0.00"
                            style={{ maxWidth: 200 }}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button className="btn btn-outline" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => saveEdit(listing.id)}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Remove confirmation modal */}
        {confirmRemove && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(11,22,40,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20
          }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>
                Remove this listing?
              </h3>
              <p style={{ color: 'var(--slate)', marginBottom: 20, fontSize: 14 }}>
                This listing will be taken down immediately and will no longer be visible to other users.
                You can relist it at any time.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmRemove(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={() => removeListing(confirmRemove)}>
                  Yes, remove it
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
