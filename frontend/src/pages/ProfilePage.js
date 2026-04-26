import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ProfilePage() {
  const { profile, loadProfile, user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    company_name:    profile?.company_name    || '',
    contact_name:    profile?.contact_name    || '',
    phone:           profile?.phone           || '',
    website:         profile?.website         || '',
    trading_address: profile?.trading_address || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current: '', newPass: '', confirm: ''
  })

  const [saving,         setSaving]         = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error,          setError]          = useState('')
  const [passwordError,  setPasswordError]  = useState('')
  const [success,        setSuccess]        = useState('')
  const [passwordSuccess,setPasswordSuccess]= useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (!form.company_name.trim()) throw new Error('Company name is required')
      if (!form.contact_name.trim()) throw new Error('Contact name is required')
      if (!form.trading_address.trim()) throw new Error('Trading address is required')

      const { error } = await supabase
        .from('user_profiles')
        .update({
          company_name:    form.company_name.trim(),
          contact_name:    form.contact_name.trim(),
          phone:           form.phone.trim() || null,
          website:         form.website.trim() || null,
          trading_address: form.trading_address.trim(),
        })
        .eq('id', profile.id)

      if (error) throw error

      // Reload profile in AuthContext so changes are reflected immediately
      await loadProfile(profile.id)
      setSuccess('Profile updated successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (passwordForm.newPass !== passwordForm.confirm) {
      return setPasswordError('New passwords do not match')
    }
    if (passwordForm.newPass.length < 12) {
      return setPasswordError('Password must be at least 12 characters')
    }
    setSavingPassword(true)
    try {
      // Re-authenticate first to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.current
      })
      if (signInError) throw new Error('Current password is incorrect')

      // Now update to new password
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
      if (error) throw error

      setPasswordSuccess('Password updated successfully')
      setPasswordForm({ current: '', newPass: '', confirm: '' })
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const roleLabel = {
    retailer: 'Retailer',
    supplier: 'Supplier',
    admin: 'Administrator'
  }[profile?.role] || profile?.role

  const statusLabel = {
    pending:   'Pending approval',
    approved:  'Active',
    suspended: 'Suspended',
    rejected:  'Cancelled'
  }[profile?.status] || profile?.status

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            My profile
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            Keep your details up to date so our team has accurate information on file.
          </p>
        </div>

        {/* Account info — read only */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
            Account details
          </h2>
          <div className="grid-2" style={{ gap: 12 }}>
            {[
              { label: 'Email address',  value: user?.email },
              { label: 'Account ID',     value: `#${profile?.id?.substring(0, 8).toUpperCase()}`, hint: 'Quote this if you ever contact support' },
              { label: 'Account type',   value: roleLabel },
              { label: 'Account status', value: statusLabel,
                badge: profile?.status === 'approved' ? 'badge-approved' : profile?.status === 'pending' ? 'badge-pending' : 'badge-rejected'
              },
            ].map((field, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {field.label}
                </div>
                {field.badge ? (
                  <span className={`badge ${field.badge}`}>{field.value}</span>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--navy)', fontWeight: 500 }}>{field.value || '—'}</div>
                )}
                {field.hint && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{field.hint}</div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            To change your email address, please contact the platform admin.
          </p>
        </div>

        {/* Editable profile */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
            Company information
          </h2>

          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Company / trading name *</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.company_name}
                  onChange={set('company_name')}
                  required
                  placeholder="Your registered company name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact name *</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.contact_name}
                  onChange={set('contact_name')}
                  required
                  placeholder="Primary contact"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone number</label>
                <input
                  className="form-input"
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+44 7700 900000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company website</label>
                <input
                  className="form-input"
                  type="url"
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://www.yourcompany.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Trading address *</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.trading_address}
                onChange={set('trading_address')}
                required
                placeholder="Your registered trading address"
                style={{ resize: 'none' }}
              />
              <span className="form-hint">
                Used for verification purposes only — never shown to other members.
              </span>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              Changes to your company name are logged for audit purposes. All details remain private and are only visible to platform administrators.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              className="btn-mobile-full" style={{ minWidth: 160, justifyContent: 'center' }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Password change */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
            Change password
          </h2>

          {passwordError   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{passwordError}</div>}
          {passwordSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{passwordSuccess}</div>}

          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current password *</label>
              <input
                className="form-input"
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                required
                placeholder="Your current password"
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">New password *</label>
                <input
                  className="form-input"
                  type="password"
                  value={passwordForm.newPass}
                  onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))}
                  required
                  placeholder="12+ characters"
                  minLength={12}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password *</label>
                <input
                  className="form-input"
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-outline"
              className="btn-mobile-full" style={{ minWidth: 160, justifyContent: 'center' }}
              disabled={savingPassword}
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Quick links to settings */}
        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 14 }}>
            Account settings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(profile?.role === 'supplier' || profile?.role === 'retailer') && (
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => navigate('/settings/brands')}
              >
                <span>Brand access — apply for additional brands</span>
                <span>→</span>
              </button>
            )}
            {(profile?.role === 'supplier' || profile?.role === 'retailer') && (
              <button
                className="btn btn-outline"
                style={{ justifyContent: 'space-between' }}
                onClick={() => navigate('/settings/payments')}
              >
                <span>Payment settings — connect your Stripe account</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
