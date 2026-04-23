import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function CreateListingPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const approvedBrands = profile?.approvedBrands || []

  const [form, setForm] = useState({
    title: '', description: '', pricePounds: '',
    quantity: '1', brandId: '', shippingMode: 'buyer_arranges',
    shippingCostPounds: '', sku: ''
  })
  const [images, setImages] = useState([]) // { file, preview, uploading, url, error }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function handleImageSelect(e) {
    const files = Array.from(e.target.files)
    const remaining = MAX_IMAGES - images.length
    const toAdd = files.slice(0, remaining)

    const invalid = toAdd.filter(f => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE)
    if (invalid.length > 0) {
      setError('Images must be JPG, PNG or WebP and under 5MB each')
      return
    }

    const newImages = toAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      url: null,
      error: null
    }))

    setImages(prev => [...prev, ...newImages])
    e.target.value = '' // reset input so same file can be re-selected
  }

  function removeImage(index) {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function uploadImages() {
    const uploaded = []
    const updated = [...images]

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].url) {
        uploaded.push(updated[i].url)
        continue
      }

      updated[i] = { ...updated[i], uploading: true }
      setImages([...updated])

      try {
        const file = updated[i].file
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
        const path = `listings/${profile.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(path, file, { contentType: file.type, upsert: false })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(path)

        updated[i] = { ...updated[i], uploading: false, url: publicUrl }
        setImages([...updated])
        uploaded.push(publicUrl)
      } catch (err) {
        updated[i] = { ...updated[i], uploading: false, error: 'Upload failed' }
        setImages([...updated])
        throw new Error('Image upload failed — please try again')
      }
    }

    return uploaded
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.brandId) return setError('Please select a brand')
    if (!form.title.trim()) return setError('Title is required')
    if (!form.pricePounds || parseFloat(form.pricePounds) <= 0) return setError('Please enter a valid price')
    if (form.shippingMode === 'included' && (!form.shippingCostPounds || parseFloat(form.shippingCostPounds) < 0)) {
      return setError('Please enter the shipping cost')
    }

    setLoading(true)
    try {
      // Upload images first if any selected
      const imageUrls = images.length > 0 ? await uploadImages() : []

      await api.createListing({
        ...form,
        pricePounds: parseFloat(form.pricePounds),
        quantity: parseInt(form.quantity) || 1,
        shippingCostPounds: form.shippingMode === 'included' ? parseFloat(form.shippingCostPounds) : undefined,
        imageUrls
      })
      navigate('/listings', { state: { message: 'Listing submitted for review' } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (approvedBrands.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>No brands assigned</h3>
            <p>You need brand permissions before you can create listings.<br />
              Please contact an administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>

        <button className="btn btn-outline btn-sm" style={{ marginBottom: 24 }} onClick={() => navigate('/listings')}>
          ← Back
        </button>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 6 }}>
          Create a listing
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 28 }}>
          Your listing will be reviewed by our team before going live.
          Your identity will never be shown to other users.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit}>

            {/* Brand */}
            <div className="form-group">
              <label className="form-label">Brand *</label>
              <select className="form-input" value={form.brandId} onChange={set('brandId')} required>
                <option value="">Select a brand…</option>
                {approvedBrands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <span className="form-hint">Only brands you are authorised to sell are shown.</span>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Listing title *</label>
              <input
                className="form-input" type="text"
                value={form.title} onChange={set('title')}
                required maxLength={150}
                placeholder="e.g. Nike Air Max 2023 — 200 units mixed sizes"
              />
              <span className="form-hint">{form.title.length}/150 characters</span>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                className="form-input"
                rows={4} value={form.description} onChange={set('description')}
                required maxLength={2000}
                placeholder="Describe the stock: condition, sizes, any relevant details…"
                style={{ resize: 'vertical' }}
              />
              <span className="form-hint">{form.description.length}/2000 characters. Do not include your company name or contact details.</span>
            </div>

            {/* Images */}
            <div className="form-group">
              <label className="form-label">Images (optional — up to {MAX_IMAGES})</label>

              {/* Image previews */}
              {images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img
                        src={img.preview}
                        alt={`Preview ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {img.uploading && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                        </div>
                      )}
                      {img.error && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(192,57,43,0.8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff', padding: 4, textAlign: 'center'
                        }}>
                          Failed
                        </div>
                      )}
                      {!img.uploading && (
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', border: 'none',
                            color: '#fff', fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {images.length < MAX_IMAGES && (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '12px 16px',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                  background: 'var(--surface)', color: 'var(--slate)',
                  fontSize: 14, transition: 'border-color 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--navy)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: 18 }}>+</span>
                  {images.length === 0 ? 'Add photos' : `Add more (${images.length}/${MAX_IMAGES})`}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
              <span className="form-hint">JPG, PNG or WebP · Max 5MB per image · First image shown as cover</span>
            </div>

            {/* Price + Quantity */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Price per unit (£) *</label>
                <input
                  className="form-input" type="number"
                  min="0.01" step="0.01"
                  value={form.pricePounds} onChange={set('pricePounds')}
                  required placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity (units) *</label>
                <input
                  className="form-input" type="number"
                  min="1" max="10000"
                  value={form.quantity} onChange={set('quantity')}
                  required
                />
              </div>
            </div>

            {/* SKU */}
            <div className="form-group">
              <label className="form-label">Your SKU / reference (optional)</label>
              <input
                className="form-input" type="text"
                value={form.sku} onChange={set('sku')}
                maxLength={100}
                placeholder="Internal reference for your records"
              />
              <span className="form-hint">This is only visible to you, not to other users.</span>
            </div>

            {/* Shipping */}
            <div className="form-group">
              <label className="form-label">Shipping *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { value: 'buyer_arranges', label: 'Buyer arranges shipping', hint: 'Buyer collects or books their own courier' },
                  { value: 'included', label: 'Optional shipping charge', hint: 'Set a shipping cost — buyer can accept or arrange their own' }
                ].map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 14px', border: '1.5px solid',
                      borderColor: form.shippingMode === opt.value ? 'var(--navy)' : 'var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: form.shippingMode === opt.value ? 'var(--surface)' : 'var(--white)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <input
                      type="radio" name="shippingMode" value={opt.value}
                      checked={form.shippingMode === opt.value}
                      onChange={set('shippingMode')}
                      style={{ marginTop: 2, accentColor: 'var(--navy)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{opt.hint}</div>
                    </div>
                  </label>
                ))}
              </div>

              {form.shippingMode === 'included' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Shipping cost (£) *</label>
                  <input
                    className="form-input" type="number"
                    min="0" step="0.01"
                    value={form.shippingCostPounds} onChange={set('shippingCostPounds')}
                    placeholder="0.00"
                    style={{ maxWidth: 200 }}
                  />
                  <span className="form-hint">Buyer can accept this charge or arrange their own delivery. Platform fee applies to goods value only.</span>
                </div>
              )}
            </div>

            <div className="alert alert-info" style={{ marginTop: 8 }}>
              🔒 Your company name and contact details will never be shown to other users. You'll be identified only as <strong>{profile?.anonymous_handle}</strong>.
            </div>

            <button
              type="submit" className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Uploading & submitting…' : 'Submit for review'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
