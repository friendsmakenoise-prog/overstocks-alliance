import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    role: 'retailer', companyName: '', contactName: '',
    phone: '', website: '', tradingAddress: ''
  })
  const [activeBrands, setActiveBrands] = useState([])
  const [selectedBrands, setSelectedBrands] = useState([])    // UUIDs of selected active brands
  const [otherBrand, setOtherBrand] = useState('')             // Freetext for unlisted brand
  const [showOther, setShowOther] = useState(false)
  const [loading, setLoading] = useState(false)
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  // Load active brands for selection
  useEffect(() => {
    async function loadBrands() {
      try {
        // Fetch brands without auth — public read for signup
        const { data } = await supabase
          .from('brands')
          .select('id, name')
          .eq('status', 'active')
          .order('name')
        setActiveBrands(data || [])
      } catch { /* silent */ }
      finally { setBrandsLoading(false) }
    }
    loadBrands()
  }, [])

  function toggleBrand(brandId) {
    setSelectedBrands(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) return setError('Passwords do not match')
    if (form.password.length < 12) return setError('Password must be at least 12 characters')
    if (selectedBrands.length === 0 && !otherBrand.trim()) {
      return setError('Please select at least one brand or enter a brand name')
    }

    setLoading(true)
    try {
      await api.signup({
        email: form.email,
        password: form.password,
        role: form.role,
        companyName: form.companyName,
        contactName: form.contactName,
        phone: form.phone,
        website: form.website,
        tradingAddress: form.tradingAddress,
        selectedBrands,
        otherBrand: otherBrand.trim() || undefined
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 12 }}>
            Application submitted
          </h2>
          <p style={{ color: 'var(--slate)', marginBottom: 8 }}>
            Please check your email to verify your address. Our team will then review your application —
            including checking your brand eligibility with relevant suppliers where applicable.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            You'll receive an email when your account is approved.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  const isSupplier = form.role === 'supplier'

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 560, width: '100%', padding: '0 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8 }}>
            Request access
          </h1>
          <p style={{ color: 'var(--slate)' }}>
            Private trading for authorised brand partners.
          Applications are reviewed by our team before access is granted.
          </p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>

            {/* Role selection */}
            <div className="form-group">
              <label className="form-label">I am a</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['retailer', 'supplier'].map(r => (
                  <label key={r} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', border: '1.5px solid',
                    borderColor: form.role === r ? 'var(--navy)' : 'var(--border)',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: form.role === r ? 'var(--surface)' : 'var(--white)',
                    transition: 'all 0.15s'
                  }}>
                    <input
                      type="radio" name="role" value={r}
                      checked={form.role === r}
                      onChange={set('role')}
                      style={{ accentColor: 'var(--navy)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, textTransform: 'capitalize' }}>{r}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {r === 'retailer' ? 'List, browse & buy overstock' : 'List & browse brand stock'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Company details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Company name *</label>
                <input className="form-input" type="text" value={form.companyName} onChange={set('companyName')} required placeholder="Acme Ltd" />
              </div>
              <div className="form-group">
                <label className="form-label">Your name *</label>
                <input className="form-input" type="text" value={form.contactName} onChange={set('contactName')} required placeholder="Jane Smith" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Work email *</label>
              <input className="form-input" type="email" value={form.email} onChange={set('email')} required placeholder="jane@acme.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input className="form-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+44 7700 900000" />
            </div>

            <div className="form-group">
              <label className="form-label">Company website (optional)</label>
              <input className="form-input" type="url" value={form.website} onChange={set('website')} placeholder="https://www.yourcompany.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Trading address *</label>
              <textarea className="form-input" rows={3} value={form.tradingAddress} onChange={set('tradingAddress')} placeholder="Registered trading address" required style={{ resize: 'none' }} />
              <span className="form-hint">Used for verification purposes only — never shown to other users.</span>
            </div>

            {/* Brand selection */}
            <div className="form-group">
              <label className="form-label">
                {isSupplier ? 'Brands you distribute *' : 'Brands you want access to *'}
              </label>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                {isSupplier
                  ? 'Select all brands you are an authorised distributor for. These will be verified during review.'
                  : 'Select the brands you are authorised to sell. Your eligibility will be verified with brand suppliers during review.'
                }
              </p>

              {/* Supplier-only: dealership tier guidance */}
              {isSupplier && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--amber-bg)',
                  border: '1px solid rgba(180,83,9,0.2)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 12,
                  fontSize: 12,
                  color: 'var(--amber)',
                  lineHeight: 1.6
                }}>
                  <strong>If your brand uses dealership tiers</strong> — for example Gold, Platinum, or Premier dealer levels — please register each tier as a separate brand entry using the "Other" field below. This allows us to match retailers to the correct product access level during review.
                </div>
              )}

              {brandsLoading ? (
                <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>Loading brands…</div>
              ) : activeBrands.length === 0 ? (
                <div style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>
                  No brands registered yet — please use the "Other" field below.
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 8, marginBottom: 10
                }}>
                  {activeBrands.map(brand => (
                    <label key={brand.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: '1.5px solid',
                      borderColor: selectedBrands.includes(brand.id) ? 'var(--navy)' : 'var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: selectedBrands.includes(brand.id) ? 'var(--surface)' : 'var(--white)',
                      fontSize: 13, transition: 'all 0.15s'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand.id)}
                        onChange={() => toggleBrand(brand.id)}
                        style={{ accentColor: 'var(--navy)' }}
                      />
                      {brand.name}
                    </label>
                  ))}
                </div>
              )}

              {/* Other brand */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', border: '1.5px solid',
                borderColor: showOther ? 'var(--navy)' : 'var(--border)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                background: showOther ? 'var(--surface)' : 'var(--white)',
                fontSize: 13, marginBottom: showOther ? 8 : 0, transition: 'all 0.15s'
              }}>
                <input
                  type="checkbox"
                  checked={showOther}
                  onChange={e => { setShowOther(e.target.checked); if (!e.target.checked) setOtherBrand('') }}
                  style={{ accentColor: 'var(--navy)' }}
                />
                Other (not listed above)
              </label>

              {showOther && (
                <div>
                  <input
                    className="form-input"
                    type="text"
                    value={otherBrand}
                    onChange={e => setOtherBrand(e.target.value)}
                    placeholder="Enter brand name(s) — separate multiple with commas"
                    maxLength={500}
                  />
                  <span className="form-hint">
                    Unlisted brands will be reviewed by our team and may require additional verification.
                  </span>
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={form.password} onChange={set('password')} required placeholder="12+ characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password *</label>
                <input className="form-input" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required placeholder="Repeat password" />
              </div>
            </div>

            <div className="form-hint" style={{ marginBottom: 16 }}>
              Your company name and contact details are kept private and never shown to other users.
              You'll be identified only by an anonymous handle.
            </div>

            {/* T&Cs */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" required style={{ marginTop: 2, accentColor: 'var(--navy)', flexShrink: 0 }} />
                <span style={{ color: 'var(--slate)', lineHeight: 1.5 }}>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" style={{ color: 'var(--navy)', fontWeight: 500 }}>Terms and Conditions</a>
                  {' '}and confirm I am acting on behalf of a registered business. I understand all transactions must be completed through the platform.
                </span>
              </label>
            </div>

            <button
              type="submit" className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Submitting…' : 'Submit application'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--navy)', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
