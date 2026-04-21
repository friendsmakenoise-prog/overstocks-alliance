import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function OfferModal({ listing, onClose }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('choose') // choose | direct | offer
  const [offerPrice, setOfferPrice] = useState('')
  const [offerQty, setOfferQty] = useState(listing.quantity)
  const [offerMessage, setOfferMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const listedPricePence = listing.price_pence
  const shippingPence = listing.shipping_cost_pence || 0
  const isPartialQty = parseInt(offerQty) < listing.quantity

  // Fee calculation preview (approximate — backend calculates exact)
  function estimateFee(totalPence) {
    if (totalPence >= 200000) return { pct: 1, fee: Math.round(totalPence * 0.01) }
    if (totalPence >= 50000)  return { pct: 2, fee: Math.round(totalPence * 0.02) }
    return { pct: 3, fee: Math.round(totalPence * 0.03) }
  }

  const directTotal = listedPricePence * listing.quantity
  const directFee = estimateFee(directTotal)

  async function handleDirect() {
    setLoading(true)
    setError('')
    try {
      const data = await api.createOffer({
        listingId: listing.id,
        offerType: 'direct',
        quantity: listing.quantity,
        offeredPricePounds: (listedPricePence / 100).toFixed(2)
      })
      // Go straight to checkout
      const checkout = await api.createCheckout(data.offer.id)
      window.location.href = checkout.checkoutUrl
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleOffer(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.createOffer({
        listingId: listing.id,
        offerType: 'offer',
        quantity: parseInt(offerQty),
        offeredPricePounds: parseFloat(offerPrice).toFixed(2),
        message: offerMessage || undefined
      })
      navigate('/offers')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(11,22,40,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20
    }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
              {mode === 'choose' ? 'How would you like to proceed?' : mode === 'direct' ? 'Buy now' : 'Make an offer'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{listing.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Mode selection */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Direct purchase option */}
            <button
              onClick={() => setMode('direct')}
              style={{
                padding: '16px 20px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)', background: 'var(--white)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--surface)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Buy now — full quantity</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                Purchase all {listing.quantity} units at the listed price. Proceeds straight to checkout.
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
                {formatPrice(listedPricePence * listing.quantity)}
                {listing.shipping_mode === 'included' && shippingPence > 0 && (
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', marginLeft: 8 }}>
                    + {formatPrice(shippingPence)} shipping
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Platform fee: ~{directFee.pct}% ({formatPrice(directFee.fee)})
              </div>
            </button>

            {/* Make offer option */}
            <button
              onClick={() => setMode('offer')}
              style={{
                padding: '16px 20px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)', background: 'var(--white)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--surface)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Make an offer</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Negotiate on price, or request a partial quantity. Seller can accept, decline, or counter.
              </div>
            </button>
          </div>
        )}

        {/* Direct purchase confirmation */}
        {mode === 'direct' && (
          <div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 20 }}>
              {[
                { label: `${listing.quantity} units × ${formatPrice(listedPricePence)}`, value: formatPrice(listedPricePence * listing.quantity) },
                listing.shipping_mode === 'included' && shippingPence > 0 && { label: 'Shipping', value: formatPrice(shippingPence) },
                { label: `Platform fee (~${directFee.pct}%)`, value: formatPrice(directFee.fee), muted: true },
                { label: 'Total charged', value: formatPrice(listedPricePence * listing.quantity + shippingPence), bold: true }
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: i < 3 ? 6 : 0, paddingTop: row.bold ? 10 : 0, borderTop: row.bold ? '1px solid var(--border)' : 'none', marginTop: row.bold ? 10 : 0 }}>
                  <span style={{ color: row.muted ? 'var(--muted)' : 'var(--slate)' }}>{row.label}</span>
                  <span style={{ fontWeight: row.bold ? 600 : 400, fontFamily: row.bold ? 'var(--font-display)' : 'inherit', fontSize: row.bold ? 20 : 14 }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              🔒 Seller identity is protected. You're buying from <strong>{listing.anonymous_handle || 'an anonymous seller'}</strong>.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setMode('choose')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>Back</button>
              <button className="btn btn-gold btn-lg" onClick={handleDirect} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Redirecting to checkout…' : 'Proceed to payment →'}
              </button>
            </div>
          </div>
        )}

        {/* Offer form */}
        {mode === 'offer' && (
          <form onSubmit={handleOffer}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Your price per unit (£) *</label>
                <input
                  className="form-input" type="number"
                  min="0.01" step="0.01"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder={`Listed: £${(listedPricePence / 100).toFixed(2)}`}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input
                  className="form-input" type="number"
                  min="1" max={listing.quantity}
                  value={offerQty}
                  onChange={e => setOfferQty(e.target.value)}
                  required
                />
                <span className="form-hint">{listing.quantity} available</span>
              </div>
            </div>

            {isPartialQty && (
              <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                Partial quantity requests must go through the offer process — the seller must accept before you can pay.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Message (optional — max 300 characters)</label>
              <textarea
                className="form-input" rows={2}
                value={offerMessage}
                onChange={e => setOfferMessage(e.target.value)}
                maxLength={300}
                placeholder="Brief note to the seller (no contact details)…"
                style={{ resize: 'none' }}
              />
              <span className="form-hint">
                {offerMessage.length}/300 · Do not include your name, email, or company details
              </span>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
              The seller can accept, decline, or make one counter-offer. If accepted, you'll be prompted to pay.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setMode('choose')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Sending…' : 'Send offer →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
