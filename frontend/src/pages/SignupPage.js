import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    role: 'retailer', companyName: '', contactName: '', phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match')
    }
    if (form.password.length < 12) {
      return setError('Password must be at least 12 characters')
    }

    setLoading(true)
    try {
      await api.signup({
        email: form.email,
        password: form.password,
        role: form.role,
        companyName: form.companyName,
        contactName: form.contactName,
        phone: form.phone
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
            Please check your email to verify your address. Once verified, our team will
            review your application and approve your account.
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

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 520, width: '100%', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8 }}>
            Request access
          </h1>
          <p style={{ color: 'var(--slate)' }}>
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
                  <label
                    key={r}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', border: '1.5px solid',
                      borderColor: form.role === r ? 'var(--navy)' : 'var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: form.role === r ? 'var(--surface)' : 'var(--white)',
                      transition: 'all 0.15s'
                    }}
                  >
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Company name *</label>
                <input
                  className="form-input" type="text" value={form.companyName}
                  onChange={set('companyName')} required placeholder="Acme Ltd"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Your name *</label>
                <input
                  className="form-input" type="text" value={form.contactName}
                  onChange={set('contactName')} required placeholder="Jane Smith"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Work email *</label>
              <input
                className="form-input" type="email" value={form.email}
                onChange={set('email')} required placeholder="jane@acme.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input
                className="form-input" type="tel" value={form.phone}
                onChange={set('phone')} placeholder="+44 7700 900000"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  className="form-input" type="password" value={form.password}
                  onChange={set('password')} required placeholder="12+ characters"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password *</label>
                <input
                  className="form-input" type="password" value={form.confirmPassword}
                  onChange={set('confirmPassword')} required placeholder="Repeat password"
                />
              </div>
            </div>

            <div className="form-hint" style={{ marginBottom: 20 }}>
              Your company name and contact details are kept private and never shown to other users.
              You'll be identified only by an anonymous handle.
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
