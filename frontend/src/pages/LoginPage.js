import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setForgotSent(true)
    } catch (err) {
      setError('Failed to send reset email — please check the address and try again')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, marginBottom: 6 }}>
            Overstocks <span style={{ color: 'var(--gold)' }}>Alliance</span>
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 15 }}>
            Sign in to your account
          </p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Forgot password form */}
          {showForgot ? (
            forgotSent ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>
                  Check your email
                </h3>
                <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 20 }}>
                  We've sent a password reset link to <strong>{forgotEmail}</strong>
                </p>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { setShowForgot(false); setForgotSent(false); setError('') }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 6 }}>
                  Reset your password
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input" type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required autoFocus placeholder="you@company.com"
                  />
                </div>
                <button
                  type="submit" className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button" className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { setShowForgot(false); setError('') }}
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            /* Normal login form */
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input" type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoFocus placeholder="you@company.com"
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(email); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  className="form-input" type="password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="Your password"
                />
              </div>

              <button
                type="submit" className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
                Don't have an account?{' '}
                <Link to="/signup" style={{ color: 'var(--navy)', fontWeight: 500 }}>Request access</Link>
              </p>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
          This is a private, invitation-only platform.<br />
          All access is reviewed and approved by our team.<br />
          <Link to="/terms" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>Terms and Conditions</Link>
        </p>
      </div>
    </div>
  )
}
