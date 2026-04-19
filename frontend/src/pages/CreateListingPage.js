import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

export default function CreateListingPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const approvedBrands = profile?.approvedBrands || []

  const [form, setForm] = useState({
    title: '', description: '', pricePounds: '',
    quantity: '1', brandId: '', shippingMode: 'buyer_arranges',
    shippingCostPounds: '', sku: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
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
      const data = await api.createListing({
        ...form,
        pricePounds: parseFloat(form.pricePounds),
        quantity: parseInt(form.quantity) || 1,
        shippingCostPounds: form.shippingMode === 'included' ? parseFloat(form.shippingCostPounds) : undefined
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
          Your identity will never be shown to buyers.
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

            {/* Price + Quantity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Total asking price (£) *</label>
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
              <span className="form-hint">This is only visible to you, not to buyers.</span>
            </div>

            {/* Shipping */}
            <div className="form-group">
              <label className="form-label">Shipping *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { value: 'buyer_arranges', label: 'Buyer arranges shipping', hint: 'Buyer collects or books their own courier' },
                  { value: 'included', label: 'Shipping included', hint: 'You will arrange and pay for delivery' }
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
                  <span className="form-hint">This will be added to the total at checkout. Platform fee applies to goods value only.</span>
                </div>
              )}
            </div>

            <div className="alert alert-info" style={{ marginTop: 8 }}>
              🔒 Your company name and contact details will never be shown to buyers. You'll be identified only as <strong>{profile?.anonymous_handle}</strong>.
            </div>

            <button
              type="submit" className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
