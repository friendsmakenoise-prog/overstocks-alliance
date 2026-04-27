import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const MAX_IMAGES = 4
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
          shipping_mode, shipping_cost_pence, image_urls, open_to_all, shipping_info, stock_outside_uk,
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

  const isSupplier = profile?.role === 'supplier'
  const [editImages, setEditImages] = useState([]) // { url, file, preview, uploading }

  async function uploadNewImages() {
    const uploaded = []
    const updated = [...editImages]
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].url) { uploaded.push(updated[i].url); continue }
      updated[i] = { ...updated[i], uploading: true }
      setEditImages([...updated])
      try {
        const file = updated[i].file
        const ext = file.name.split('.').pop()
        const path = `listings/${profile.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file, { contentType: file.type })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
        updated[i] = { ...updated[i], uploading: false, url: publicUrl }
        setEditImages([...updated])
        uploaded.push(publicUrl)
      } catch (err) {
        updated[i] = { ...updated[i], uploading: false, error: 'Upload failed' }
        setEditImages([...updated])
        throw new Error('Image upload failed')
      }
    }
    return uploaded
  }

  function handleEditImageSelect(e) {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_IMAGES - editImages.length
    const valid = files.filter(f => ALLOWED_TYPES.includes(f.type) && f.size < 5 * 1024 * 1024).slice(0, remaining)
    setEditImages(prev => [...prev, ...valid.map(file => ({
      file, preview: URL.createObjectURL(file), url: null, uploading: false
    }))])
    e.target.value = ''
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
      sku: listing.sku || '',
      openToAll: listing.open_to_all || false,
      shippingInfo: listing.shipping_info || '',
      stockOutsideUK: listing.stock_outside_uk || false
    })
    setEditImages((listing.image_urls || []).map(url => ({ url, file: null, preview: url, uploading: false })))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
    setEditImages([])
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
        shipping_info: editForm.shippingInfo?.trim() || null,
        stock_outside_uk: editForm.stockOutsideUK || false,
        ...(isSupplier ? { open_to_all: editForm.openToAll } : {}),
        status: 'pending_review'
      }

      if (!updates.title) return setError('Title is required')
      if (isNaN(updates.price_pence) || updates.price_pence <= 0) return setError('Please enter a valid price')

      // Upload any new images and collect all URLs
      const imageUrls = await uploadNewImages()
      if (imageUrls.length > 0) {
        updates.image_urls = imageUrls
      }

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

  async function toggleOpenToAll(listingId, currentValue) {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ open_to_all: !currentValue })
        .eq('id', listingId)
        .eq('seller_id', profile.id) // Security: can only edit own listings

      if (error) throw error
      // Optimistic update
      setListings(prev => prev.map(l =>
        l.id === listingId ? { ...l, open_to_all: !currentValue } : l
      ))
    } catch (err) {
      setError('Failed to update listing — ' + err.message)
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

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: isSupplier ? 16 : 28 }}>
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

        {/* Supplier: open-to-all explanation */}
        {isSupplier && listings.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'var(--amber-bg)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 'var(--radius)', marginBottom: 24, fontSize: 13, color: 'var(--amber)', lineHeight: 1.6 }}>
            <strong>⭐ Open to all</strong> — use this toggle on any active listing to make it visible to all verified retailers, not just those authorised for your brand. Ideal for clearance or discontinued lines. Toggle it off at any time to restore normal brand-gated access.
          </div>
        )}

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
                      width: 80, height: 80, background: 'var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0
                    }}>
                      {listing.image_urls?.length > 0 ? (
                        <img
                          src={listing.image_urls[0]}
                          alt={listing.title}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
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
                        {listing.open_to_all && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 7px', borderRadius: 100, border: '1px solid rgba(180,83,9,0.2)' }}>
                            OPEN TO ALL
                          </span>
                        )}
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
                    <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', borderLeft: '1px solid var(--border)', minWidth: 130 }}>
                      {listing.status !== 'removed' && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startEdit(listing)}
                          style={{ justifyContent: 'center' }}
                        >
                          ✏️ Edit
                        </button>
                      )}

                      {/* Open to all quick toggle — suppliers only, active listings only */}
                      {isSupplier && listing.status === 'active' && (
                        <button
                          className="btn btn-sm"
                          style={{
                            justifyContent: 'center',
                            background: listing.open_to_all ? 'var(--amber-bg)' : 'var(--surface)',
                            border: `1.5px solid ${listing.open_to_all ? 'var(--amber)' : 'var(--border)'}`,
                            color: listing.open_to_all ? 'var(--amber)' : 'var(--slate)',
                            fontWeight: 500
                          }}
                          onClick={() => toggleOpenToAll(listing.id, listing.open_to_all)}
                          title={listing.open_to_all ? 'Remove open to all — restrict to authorised dealers' : 'Mark as open to all verified retailers'}
                        >
                          {listing.open_to_all ? '⭐ Open to all' : '☆ Open to all'}
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
                      <label className="form-label">Images</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 8 }}>
                        {editImages.map((img, i) => (
                          <div key={i} style={{ position: 'relative', paddingTop: '100%', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <img
                              src={img.preview}
                              alt=""
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                            />
                            {img.uploading && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="spinner" style={{ width: 20, height: 20 }} />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditImages(prev => prev.filter((_, j) => j !== i))}
                              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {editImages.length < MAX_IMAGES && (
                          <label style={{ paddingTop: '100%', position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)', cursor: 'pointer', display: 'block' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
                              <span style={{ fontSize: 20 }}>+</span>
                              <span>Add</span>
                            </div>
                            <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleEditImageSelect} />
                          </label>
                        )}
                      </div>
                      <span className="form-hint">Up to {MAX_IMAGES} images. JPG, PNG or WebP, max 5MB each.</span>
                    </div>

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
                        <label className="form-label">Price per unit (£) *</label>
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
                          { value: 'included', label: 'Optional shipping charge' }
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

                    <div className="form-group">
                      <label className="form-label">Shipping information (optional)</label>
                      <textarea
                        className="form-input" rows={2}
                        value={editForm.shippingInfo || ''}
                        onChange={e => setEditForm(f => ({ ...f, shippingInfo: e.target.value }))}
                        placeholder="e.g. 2 pallets, approx 200kg. Available for collection from [region]."
                        style={{ resize: 'none' }}
                        maxLength={500}
                      />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={editForm.stockOutsideUK || false}
                        onChange={e => setEditForm(f => ({ ...f, stockOutsideUK: e.target.checked }))}
                        style={{ accentColor: 'var(--amber)' }}
                      />
                      <span style={{ color: editForm.stockOutsideUK ? 'var(--amber)' : 'var(--slate)', fontWeight: editForm.stockOutsideUK ? 500 : 400 }}>
                        Stock located outside the UK
                      </span>
                    </label>

                    {/* Open to all — suppliers only */}
                    {isSupplier && (
                      <div style={{
                        padding: '12px 14px',
                        background: editForm.openToAll ? 'var(--amber-bg)' : 'var(--surface)',
                        border: `1.5px solid ${editForm.openToAll ? 'var(--amber)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        marginTop: 4,
                        transition: 'all 0.15s'
                      }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editForm.openToAll || false}
                            onChange={e => setEditForm(f => ({ ...f, openToAll: e.target.checked }))}
                            style={{ accentColor: 'var(--amber)', marginTop: 2, flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13, color: editForm.openToAll ? 'var(--amber)' : 'var(--navy)' }}>
                              Open to all verified retailers
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2, lineHeight: 1.5 }}>
                              Tick to make this listing visible to all approved retailers, not just those authorised for your brand. Ideal for clearance or discontinued lines.
                            </div>
                          </div>
                        </label>
                      </div>
                    )}

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
