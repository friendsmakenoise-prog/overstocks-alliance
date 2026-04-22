import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

export default function PaymentSettingsPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [error, setError] = useState('')

  const isSuccess = new URLSearchParams(location.search).get('success')
  const isRefresh = new URLSearchParams(location.search).get('refresh')

  // Profile is guaranteed here — ProtectedRoute waits for it
  useEffect(() => { loadStatus() }, [profile?.id])

  async function loadStatus() {
    setLoading(true)
    try {
      const data = await api.getConnectStatus()
      setStatus(data)
    } catch (err) {
      setError('Failed to check payment status')
    } finally {
      setLoading(false)
    }
  }

  async function startOnboarding() {
    setOnboarding(true)
    try {
      const data = await api.startConnectOnboard()
      window.location.href = data.onboardingUrl
    } catch (err) {
      setError(err.message)
      setOnboarding(false)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 580 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 6 }}>
          Payment settings
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 28 }}>
          Connect your bank account to receive payouts when your listings sell.
        </p>

        {isSuccess && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            ✓ Your payment account has been connected successfully.
          </div>
        )}
        {isRefresh && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            Your onboarding session expired. Please start again below.
          </div>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="card">
          {!status?.connected ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
                Connect your bank account
              </h2>
              <p style={{ color: 'var(--slate)', marginBottom: 24, fontSize: 14 }}>
                To receive payments when your listings sell, you need to connect a bank account via Stripe.
                This is handled entirely by Stripe — we never see your banking details.
              </p>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'var(--muted)', textAlign: 'left' }}>
                <div style={{ marginBottom: 6 }}>✓ Takes about 5 minutes</div>
                <div style={{ marginBottom: 6 }}>✓ Secure — powered by Stripe</div>
                <div style={{ marginBottom: 6 }}>✓ Required before your listings can be purchased</div>
                <div>✓ Payouts sent directly to your bank after each sale</div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ justifyContent: 'center' }}
                onClick={startOnboarding}
                disabled={onboarding}
              >
                {onboarding ? 'Redirecting to Stripe…' : 'Connect bank account →'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>Payment account connected</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Powered by Stripe</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Can receive payments', value: status.charges_enabled },
                  { label: 'Payouts enabled', value: status.payouts_enabled },
                  { label: 'Onboarding complete', value: status.onboarding_complete },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 14 }}>
                    <span style={{ color: 'var(--slate)' }}>{item.label}</span>
                    <span className={`badge ${item.value ? 'badge-approved' : 'badge-pending'}`}>
                      {item.value ? 'Active' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>

              {!status.onboarding_complete && (
                <div className="alert alert-warning" style={{ marginTop: 16 }}>
                  Your account setup is not complete. Please finish the Stripe onboarding to start receiving payments.
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 8, display: 'block' }} onClick={startOnboarding} disabled={onboarding}>
                    {onboarding ? 'Redirecting…' : 'Complete setup →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, textAlign: 'center' }}>
          Payments are processed by Stripe. Platform fee of 1–3% applies per transaction.
        </p>
      </div>
    </div>
  )
}
