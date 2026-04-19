import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function PendingPage() {
  const { signOut } = useAuth()
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--amber-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 24
        }}>⏳</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 12 }}>
          Application under review
        </h2>
        <p style={{ color: 'var(--slate)', marginBottom: 8 }}>
          Your account is currently being reviewed by our team. This usually takes 1–2 business days.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
          You'll receive an email at the address you registered with once your account is approved.
        </p>
        <button onClick={signOut} className="btn btn-outline">
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AccessDeniedPage() {
  const { signOut } = useAuth()
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--red-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 24
        }}>✕</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 12 }}>
          Access not granted
        </h2>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
          Your account does not currently have access to this platform.
          If you believe this is an error, please contact us.
        </p>
        <button onClick={signOut} className="btn btn-outline">
          Sign out
        </button>
      </div>
    </div>
  )
}
